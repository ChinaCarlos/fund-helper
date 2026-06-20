//! macOS: NSStatusItem 的 title 文字区域点击不会进入 tray-icon 的 TrayTarget，
//! 因此用 NSEvent 本地监听器捕获整个 status bar button 的左键（类似电脑管家 popover）。

use std::ptr::NonNull;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2_app_kit::{NSEvent, NSEventMask, NSEventType, NSStatusItem, NSWindow};
use objc2_core_graphics::{CGDisplayPixelsHigh, CGMainDisplayID};
use objc2_foundation::{MainThreadMarker, NSPoint, NSPointInRect, NSRect};
use tauri::{AppHandle, PhysicalPosition};

use super::menu_bar;

fn flip_screen_y(y: f64) -> f64 {
    CGDisplayPixelsHigh(CGMainDisplayID()) as f64 - y
}

fn tray_rect_from_window(window: &NSWindow) -> tauri::Rect {
    let frame = window.frame();
    let scale = window.backingScaleFactor();
    tauri::Rect {
        position: tauri::Position::Physical(tauri::PhysicalPosition {
            x: (frame.origin.x * scale) as i32,
            y: (flip_screen_y(frame.origin.y) * scale) as i32,
        }),
        size: tauri::Size::Physical(tauri::PhysicalSize {
            width: (frame.size.width * scale) as u32,
            height: (frame.size.height * scale) as u32,
        }),
    }
}

fn cursor_position(window: &NSWindow) -> PhysicalPosition<f64> {
    let mouse = NSEvent::mouseLocation();
    let scale = window.backingScaleFactor();
    PhysicalPosition {
        x: mouse.x * scale,
        y: flip_screen_y(mouse.y) * scale,
    }
}

fn point_in_button(event: &NSEvent, status_item: &NSStatusItem, mtm: MainThreadMarker) -> bool {
    let Some(button) = status_item.button(mtm) else {
        return false;
    };
    let Some(button_window) = button.window() else {
        return false;
    };
    let Some(event_window) = event.window(mtm) else {
        return false;
    };
    if !std::ptr::eq(
        Retained::as_ptr(&event_window),
        Retained::as_ptr(&button_window),
    ) {
        return false;
    }
    let location: NSPoint = event.locationInWindow();
    let bounds: NSRect = button.bounds();
    NSPointInRect(location, bounds)
}

fn handle_left_click(app: &AppHandle, event: &NSEvent, status_item: &NSStatusItem, mtm: MainThreadMarker) {
    let Some(button) = status_item.button(mtm) else {
        return;
    };
    let Some(window) = button.window() else {
        return;
    };

    let cursor = cursor_position(&window);
    let anchor = menu_bar::tray_anchor_rect(app).unwrap_or_else(|| tray_rect_from_window(&window));

    menu_bar::toggle_popover(app, anchor, Some(cursor));
    let _ = event;
}

/// Install a local mouse-down monitor on the status item button (covers icon + title).
pub fn install(app: &AppHandle) -> Result<(), String> {
    let app = app.clone();
    let tray = app
        .tray_by_id("main-tray")
        .ok_or_else(|| "main-tray not found".to_string())?;

    tray.with_inner_tray_icon(move |inner| -> Result<(), String> {
        let Some(status_item) = inner.ns_status_item().map(|item| item.clone()) else {
            return Err("NSStatusItem unavailable".to_string());
        };

        let app_handle = app.clone();
        let status_item_for_block = status_item.clone();

        let handler = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
            let event = unsafe { event.as_ref() };
            let mtm = MainThreadMarker::new().expect("tray click monitor must run on main thread");

            if event.r#type() != NSEventType::LeftMouseDown {
                return event as *const NSEvent as *mut NSEvent;
            }

            if point_in_button(event, &status_item_for_block, mtm) {
                handle_left_click(&app_handle, event, &status_item_for_block, mtm);
                return std::ptr::null_mut();
            }

            event as *const NSEvent as *mut NSEvent
        });

        let monitor = unsafe {
            NSEvent::addLocalMonitorForEventsMatchingMask_handler(
                NSEventMask::LeftMouseDown,
                &handler,
            )
        };

        let Some(monitor) = monitor else {
            return Err("failed to install tray click monitor".to_string());
        };

        // Keep monitor alive for the lifetime of the app.
        std::mem::forget(monitor);

        Ok(())
    })
    .map_err(|e| e.to_string())?
}
