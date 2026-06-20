use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

fn build_tray_menu(app: &AppHandle, show_text: &str, quit_text: &str) -> tauri::Result<Menu<tauri::Wry>> {
    Menu::with_id_and_items(
        app,
        "system-tray",
        &[
            &MenuItem::with_id(app, "show", show_text, true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", quit_text, true, None::<&str>)?,
        ],
    )
}

// Update tray menu with localized text
pub fn update_tray_menu(app: &AppHandle, show_text: &str, quit_text: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // macOS: never call tray.set_menu() after creation — it breaks left-click handlers.
        let _ = build_tray_menu(app, show_text, quit_text).map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let menu = build_tray_menu(app, show_text, quit_text).map_err(|e| e.to_string())?;
        if let Some(tray) = app.tray_by_id("main-tray") {
            tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

fn handle_tray_click(_app: &AppHandle, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up | MouseButtonState::Down,
            ..
        } => {
            // macOS title clicks are handled by macos_tray_click (NSEvent monitor).
            #[cfg(not(target_os = "macos"))]
            if let Some(window) = _app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}

/// Create the system tray icon (idempotent). Must run on the main thread during app setup.
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    if app.tray_by_id("main-tray").is_some() {
        return Ok(());
    }

    let _menu = build_tray_menu(app, "显示 Fund Helper", "退出")?;
    let icon = tauri::include_image!("icons/tray-icon.png");

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("Fund Helper · 养基宝持仓")
        .show_menu_on_left_click(false);

    #[cfg(target_os = "macos")]
    {
        // Do NOT attach menu to NSStatusItem — it intercepts left clicks on macOS.
        builder = builder.title("Fund Helper").icon_as_template(true);
    }

    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.menu(&menu);
    }

    builder
        .on_tray_icon_event(|tray, event| {
            handle_tray_click(tray.app_handle(), event);
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    #[cfg(target_os = "macos")]
    if let Err(err) = super::macos_tray_click::install(app) {
        eprintln!("Failed to install macOS tray click monitor: {err}");
    }

    Ok(())
}
