mod commands;
mod db;
mod error;
mod income;
mod notify;
mod portfolio;
mod yjb;

mod plugins;

use tauri::Manager;

use db::AppState;

#[tauri::command]
fn update_tray_menu(app: tauri::AppHandle, show_text: String, quit_text: String) -> Result<(), String> {
    plugins::system_tray::update_tray_menu(&app, &show_text, &quit_text)
}

/// Called by the frontend after every successful portfolio fetch to keep the
/// tray title in sync.  income is in CNY, rate is a percentage (e.g. 2.34).
#[tauri::command]
fn update_tray_title(app: tauri::AppHandle, income: f64, rate: f64) {
    #[cfg(target_os = "macos")]
    plugins::menu_bar::set_tray_title(&app, income, rate);
    #[cfg(not(target_os = "macos"))]
    let _ = (income, rate);
}

/// Called by the frontend on logout to clear the tray title.
#[tauri::command]
fn clear_tray_title(app: tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    plugins::menu_bar::clear_tray_title(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
                let _ = window.show();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let state = AppState::new(app.handle())?;
            app.manage(state);

            plugins::system_tray::setup_tray(app.handle())?;
            #[cfg(target_os = "macos")]
            if let Err(e) = plugins::menu_bar::init_popover(app.handle()) {
                eprintln!("Failed to create menubar popover: {e}");
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                notify::scheduler::run(handle).await;
            });
            #[cfg(target_os = "macos")]
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    plugins::menu_bar::refresh_if_logged_in(&handle).await;
                });
            }
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let _ = window_clone.hide();
                        api.prevent_close();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_tray_menu,
            update_tray_title,
            clear_tray_title,
            commands::create_qr,
            commands::poll_qr_state,
            commands::complete_qr_login,
            commands::get_auth_status,
            commands::logout,
            commands::fetch_portfolio,
            commands::get_notification_config,
            commands::save_notification_config,
            commands::push_notification_now,
            commands::push_notification_if_manual,
            commands::test_notification_channel,
            commands::list_delivery_targets,
            commands::create_feishu_notification_group_cmd,
            commands::get_collect_income_line,
            commands::get_account_income_lines,
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
