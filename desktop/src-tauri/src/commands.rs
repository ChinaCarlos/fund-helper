use std::collections::HashMap;

use tauri::State;

use crate::db::AppState;
use crate::error::CommandError;
use crate::income::IncomeLineData;
use crate::income::{normalize_income_line, normalize_income_lines};
use crate::notify::{
    create_feishu_notification_group, list_delivery_chats, push_portfolio_notification,
    should_run_manual_push, test_channel_connectivity, ConnectivityTestResponse,
    DeliveryTargetsResponse, FeishuCreateGroupResponse, PushResponse,
};
use crate::portfolio::{fetch_portfolio_snapshot, PortfolioSnapshot};
use crate::yjb::{QrCreateResult, QrStateResult, YjbClient};

use crate::db::AuthStatus;

#[tauri::command]
pub async fn create_qr() -> Result<QrCreateResult, CommandError> {
    YjbClient::new("")
        .get_qrcode()
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn poll_qr_state(qr_id: String) -> Result<QrStateResult, CommandError> {
    YjbClient::new("")
        .get_qrcode_state(&qr_id)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn complete_qr_login(
    state: State<'_, AppState>,
    token: String,
    nickname: String,
    avatar: String,
) -> Result<AuthStatus, CommandError> {
    let store = state.store.lock().map_err(|_| CommandError {
        message: "内部锁错误".into(),
        status_code: 500,
    })?;
    let login_time = chrono::Utc::now().to_rfc3339();
    store
        .save_session(&token, &nickname, &avatar, &login_time)
        .map_err(CommandError::from)?;
    store.auth_status().map_err(CommandError::from)
}

#[tauri::command]
pub fn get_auth_status(state: State<'_, AppState>) -> Result<AuthStatus, CommandError> {
    state
        .store
        .lock()
        .map_err(|_| CommandError {
            message: "内部锁错误".into(),
            status_code: 500,
        })?
        .auth_status()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn logout(state: State<'_, AppState>) -> Result<(), CommandError> {
    state
        .store
        .lock()
        .map_err(|_| CommandError {
            message: "内部锁错误".into(),
            status_code: 500,
        })?
        .clear_session()
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn fetch_portfolio(state: State<'_, AppState>) -> Result<PortfolioSnapshot, CommandError> {
    let token = state
        .store
        .lock()
        .map_err(|_| CommandError {
            message: "内部锁错误".into(),
            status_code: 500,
        })?
        .require_token()
        .map_err(CommandError::from)?;

    fetch_portfolio_snapshot(&token)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_notification_config(state: State<'_, AppState>) -> Result<String, CommandError> {
    state
        .store
        .lock()
        .map_err(|_| CommandError {
            message: "内部锁错误".into(),
            status_code: 500,
        })?
        .get_notification_config()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn save_notification_config(
    state: State<'_, AppState>,
    config_json: String,
) -> Result<(), CommandError> {
    state
        .store
        .lock()
        .map_err(|_| CommandError {
            message: "内部锁错误".into(),
            status_code: 500,
        })?
        .save_notification_config(&config_json)
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn push_notification_now(state: State<'_, AppState>) -> Result<PushResponse, CommandError> {
    let (token, config_json) = {
        let store = state.store.lock().map_err(|_| CommandError {
            message: "内部锁错误".into(),
            status_code: 500,
        })?;
        let token = store.require_token().map_err(CommandError::from)?;
        let config_json = store.get_notification_config().map_err(CommandError::from)?;
        (token, config_json)
    };

    let config: serde_json::Value =
        serde_json::from_str(&config_json).unwrap_or(serde_json::json!({}));
    let snapshot = fetch_portfolio_snapshot(&token)
        .await
        .map_err(CommandError::from)?;
    Ok(push_portfolio_notification(&config, &snapshot).await)
}

#[tauri::command]
pub async fn push_notification_if_manual(
    state: State<'_, AppState>,
) -> Result<Option<PushResponse>, CommandError> {
    let (token, config_json) = {
        let store = state.store.lock().map_err(|_| CommandError {
            message: "内部锁错误".into(),
            status_code: 500,
        })?;
        let token = store.require_token().map_err(CommandError::from)?;
        let config_json = store.get_notification_config().map_err(CommandError::from)?;
        (token, config_json)
    };

    let config: serde_json::Value =
        serde_json::from_str(&config_json).unwrap_or(serde_json::json!({}));
    if !should_run_manual_push(&config) {
        return Ok(None);
    }

    let snapshot = fetch_portfolio_snapshot(&token)
        .await
        .map_err(CommandError::from)?;
    Ok(Some(push_portfolio_notification(&config, &snapshot).await))
}

#[tauri::command]
pub async fn test_notification_channel(
    state: State<'_, AppState>,
    channel: String,
    config_json: String,
) -> Result<ConnectivityTestResponse, CommandError> {
    let config: serde_json::Value =
        serde_json::from_str(&config_json).unwrap_or(serde_json::json!({}));

    let snapshot = {
        let token = {
            let store = state.store.lock().map_err(|_| CommandError {
                message: "内部锁错误".into(),
                status_code: 500,
            })?;
            store.require_token().ok()
        };
        if let Some(token) = token {
            fetch_portfolio_snapshot(&token).await.ok()
        } else {
            None
        }
    };

    Ok(test_channel_connectivity(&channel, &config, snapshot.as_ref()).await)
}

#[tauri::command]
pub async fn list_delivery_targets(
    channel: String,
    config_json: String,
) -> Result<DeliveryTargetsResponse, CommandError> {
    let config: serde_json::Value =
        serde_json::from_str(&config_json).unwrap_or(serde_json::json!({}));
    Ok(list_delivery_chats(&channel, &config).await)
}

#[tauri::command]
pub async fn create_feishu_notification_group_cmd(
    config_json: String,
    mobile: String,
    group_name: String,
) -> Result<FeishuCreateGroupResponse, CommandError> {
    let config: serde_json::Value =
        serde_json::from_str(&config_json).unwrap_or(serde_json::json!({}));
    create_feishu_notification_group(&config, &mobile, &group_name)
        .await
        .map_err(|msg| CommandError {
            message: msg,
            status_code: 400,
        })
}

#[tauri::command]
pub async fn get_collect_income_line(state: State<'_, AppState>) -> Result<IncomeLineData, CommandError> {
    let token = state
        .store
        .lock()
        .map_err(|_| CommandError {
            message: "内部锁错误".into(),
            status_code: 500,
        })?
        .require_token()
        .map_err(CommandError::from)?;

    let client = YjbClient::new(token);
    let data = client
        .get_income_line_data(true, &[])
        .await
        .map_err(CommandError::from)?;
    Ok(normalize_income_line(&data, None))
}

#[tauri::command]
pub async fn get_account_income_lines(
    state: State<'_, AppState>,
    account_ids: Vec<i64>,
) -> Result<HashMap<String, IncomeLineData>, CommandError> {
    let token = state
        .store
        .lock()
        .map_err(|_| CommandError {
            message: "内部锁错误".into(),
            status_code: 500,
        })?
        .require_token()
        .map_err(CommandError::from)?;

    let client = YjbClient::new(token);
    let data = client
        .get_income_line_data(false, &account_ids)
        .await
        .map_err(CommandError::from)?;
    Ok(normalize_income_lines(&data, &account_ids))
}
