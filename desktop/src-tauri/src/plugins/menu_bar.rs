use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindowBuilder};

use crate::portfolio::PortfolioSnapshot;

// ── Window dimensions ────────────────────────────────────────────────────────
const POPOVER_W: f64 = 380.0;
const POPOVER_H: f64 = 580.0;
const POPOVER_GAP: f64 = 6.0;

/// Ignore blur briefly after opening, otherwise the tray click closes the popover instantly.
static SUPPRESS_POPOVER_BLUR: AtomicBool = AtomicBool::new(false);

fn menubar_webview_url() -> tauri::WebviewUrl {
    // Always use App URL so Tauri injects IPC (External localhost skips __TAURI__ in dev).
    tauri::WebviewUrl::App("menubar.html".into())
}

fn monitor_scale(app: &AppHandle) -> f64 {
    app.primary_monitor()
        .ok()
        .flatten()
        .map(|m| m.scale_factor())
        .unwrap_or(2.0)
}

fn screen_logical_size(app: &AppHandle) -> (f64, f64) {
    app.primary_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let scale = m.scale_factor();
            let s = m.size();
            (s.width as f64 / scale, s.height as f64 / scale)
        })
        .unwrap_or((1440.0, 900.0))
}

/// Convert tray rect into logical screen coordinates (origin top-left, y down).
fn rect_to_logical(rect: tauri::Rect, scale: f64) -> (f64, f64, f64, f64) {
    match (rect.position, rect.size) {
        (tauri::Position::Logical(pos), tauri::Size::Logical(size)) => {
            (pos.x, pos.y, size.width, size.height)
        }
        (tauri::Position::Physical(pos), tauri::Size::Physical(size)) => (
            pos.x as f64 / scale,
            pos.y as f64 / scale,
            size.width as f64 / scale,
            size.height as f64 / scale,
        ),
        (tauri::Position::Logical(pos), tauri::Size::Physical(size)) => (
            pos.x,
            pos.y,
            size.width as f64 / scale,
            size.height as f64 / scale,
        ),
        (tauri::Position::Physical(pos), tauri::Size::Logical(size)) => (
            pos.x as f64 / scale,
            pos.y as f64 / scale,
            size.width,
            size.height,
        ),
    }
}

/// Popover top-left, centered under the tray status item (like 电脑管家).
fn popover_position_below_tray(
    app: &AppHandle,
    anchor: tauri::Rect,
    cursor: Option<PhysicalPosition<f64>>,
) -> tauri::LogicalPosition<f64> {
    let scale = monitor_scale(app);
    let (screen_w, _screen_h) = screen_logical_size(app);
    let (pos_x, pos_y, size_w, size_h) = rect_to_logical(anchor, scale);

    let mut x = pos_x + size_w / 2.0 - POPOVER_W / 2.0;
    let mut y = pos_y + size_h + POPOVER_GAP;

    // Fallback when tray rect is unreliable — anchor below cursor.
    if let Some(cursor) = cursor {
        if size_w < 1.0 || size_h < 1.0 {
            x = cursor.x / scale - POPOVER_W / 2.0;
            y = cursor.y / scale + POPOVER_GAP;
        }
    }

    let margin = 8.0;
    x = x.max(margin).min((screen_w - POPOVER_W - margin).max(margin));
    y = y.max(margin);

    tauri::LogicalPosition::new(x, y)
}

pub fn tray_anchor_rect(app: &AppHandle) -> Option<tauri::Rect> {
    app.tray_by_id("main-tray")
        .and_then(|tray| tray.rect().ok().flatten())
}

fn schedule_popover_blur_guard() {
    SUPPRESS_POPOVER_BLUR.store(true, Ordering::SeqCst);
    std::thread::spawn(|| {
        std::thread::sleep(Duration::from_millis(350));
        SUPPRESS_POPOVER_BLUR.store(false, Ordering::SeqCst);
    });
}

// ── Popover window lifecycle ─────────────────────────────────────────────────

/// Create the hidden popover window on startup (idempotent).
pub fn init_popover(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window("menubar-popover").is_some() {
        return Ok(());
    }

    let popover = WebviewWindowBuilder::new(app, "menubar-popover", menubar_webview_url())
        .title("")
        .decorations(false)
        .transparent(true)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .shadow(true)
        .focused(false)
        .inner_size(POPOVER_W, POPOVER_H)
        .build()
        .map_err(|e| e.to_string())?;

    let handle = popover.clone();
    popover.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            if SUPPRESS_POPOVER_BLUR.load(Ordering::SeqCst) {
                return;
            }
            let _ = handle.hide();
        }
    });

    Ok(())
}

// ── Tray title ───────────────────────────────────────────────────────────────

/// Update the macOS menu-bar tray title to show today's income & rate.
pub fn set_tray_title(app: &AppHandle, income: f64, rate: f64) {
    let sign = if income > 0.0 { "+" } else { "" };
    let rate_sign = if rate > 0.0 { "+" } else { "" };
    let title = format!("{}{:.2}  {}{:.2}%", sign, income, rate_sign, rate);
    if let Some(tray) = app.tray_by_id("main-tray") {
        if let Err(err) = tray.set_title(Some(&title)) {
            eprintln!("Failed to set tray title: {err}");
        }
    } else {
        eprintln!("Tray icon main-tray not found when setting title");
    }
}

/// Clear the tray title (e.g. after logout).
pub fn clear_tray_title(app: &AppHandle) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_title(Some("Fund Helper"));
    }
}

// ── Snapshot sync ────────────────────────────────────────────────────────────

/// Update tray title + push event to popover (if visible).
pub fn sync_from_snapshot(app: &AppHandle, snapshot: &PortfolioSnapshot) {
    set_tray_title(app, snapshot.today_income, snapshot.today_income_rate);

    if let Some(popover) = app.get_webview_window("menubar-popover") {
        if popover.is_visible().unwrap_or(false) {
            let _ = popover.emit("portfolio-updated", snapshot.clone());
        }
    }
}

// ── Popover toggle / position ─────────────────────────────────────────────────

fn show_popover(app: &AppHandle, anchor: tauri::Rect, cursor: Option<PhysicalPosition<f64>>) {
    let Some(popover) = app.get_webview_window("menubar-popover") else {
        eprintln!("menubar-popover window missing");
        return;
    };

    let position = popover_position_below_tray(app, anchor, cursor);
    schedule_popover_blur_guard();
    let _ = popover.set_position(position);
    let _ = popover.show();
    let _ = popover.set_focus();
    let _ = popover.emit("popover-shown", ());
}

/// Show or hide the popover, anchored below the tray icon / click position.
pub fn toggle_popover(app: &AppHandle, anchor: tauri::Rect, cursor: Option<PhysicalPosition<f64>>) {
    if app.get_webview_window("menubar-popover").is_none() {
        if let Err(err) = init_popover(app) {
            eprintln!("Failed to lazy-init menubar popover: {err}");
            return;
        }
    }

    let Some(popover) = app.get_webview_window("menubar-popover") else {
        eprintln!("menubar-popover window missing");
        return;
    };

    if popover.is_visible().unwrap_or(false) {
        let _ = popover.hide();
        return;
    }

    show_popover(app, anchor, cursor);
}

pub async fn refresh_if_logged_in(app: &AppHandle) {
    let token = {
        let state = match app.try_state::<crate::db::AppState>() {
            Some(state) => state,
            None => return,
        };
        let Ok(store) = state.store.lock() else {
            return;
        };
        store.require_token().ok()
    };
    let Some(token) = token else { return };

    if let Ok(snapshot) = crate::portfolio::fetch_portfolio_snapshot(&token).await {
        sync_from_snapshot(app, &snapshot);
    }
}
