use tauri::{AppHandle, Manager};

use crate::db::AppState;
use crate::notify::config::frequency_interval_ms;
use crate::notify::push::{push_portfolio_notification, should_run_scheduled_push};
use crate::portfolio::fetch_portfolio_snapshot;

const TICK_SECS: u64 = 30;

pub async fn run(app: AppHandle) {
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(TICK_SECS)).await;
        if let Err(err) = tick(&app).await {
            eprintln!("[notify-scheduler] {err}");
        }
    }
}

async fn tick(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();

    let (config_json, last_push_ms, token) = {
        let store = state.store.lock().map_err(|_| "lock error".to_string())?;
        let config_json = store.get_notification_config().map_err(|e| e.to_string())?;
        let last_push_ms = store.get_last_scheduled_push_ms().map_err(|e| e.to_string())?;
        let token = store.require_token().ok();
        (config_json, last_push_ms, token)
    };

    let Some(token) = token else {
        return Ok(());
    };

    let config: serde_json::Value =
        serde_json::from_str(&config_json).unwrap_or(serde_json::json!({}));

    if !should_run_scheduled_push(&config, last_push_ms) {
        return Ok(());
    }

    let freq = crate::notify::config::frequency(&config);
    if frequency_interval_ms(freq).is_none() {
        return Ok(());
    }

    let snapshot = fetch_portfolio_snapshot(&token)
        .await
        .map_err(|e| e.to_string())?;

    let result = push_portfolio_notification(&config, &snapshot).await;
    if result.status == "skipped" {
        return Ok(());
    }

    {
        let store = state.store.lock().map_err(|_| "lock error".to_string())?;
        store
            .set_last_scheduled_push_ms(chrono::Utc::now().timestamp_millis())
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
