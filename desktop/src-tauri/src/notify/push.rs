use serde::Serialize;
use serde_json::Value;
use crate::notify::config::{
    app_enabled, channel_cfg, config_enabled, includes_portfolio, is_channel_active,
    is_channel_push_active, trim_str, webhook_enabled,
};
use crate::notify::feishu_app::{has_feishu_app_delivery, send_feishu_app_card, send_feishu_webhook_card};
use crate::notify::feishu_card::{build_connectivity_test_card, build_portfolio_feishu_card};
use crate::notify::template::{build_connectivity_test_message, build_portfolio_notification};
use crate::notify::webhook::{send_channel_webhook, ConnectivityTestResponse};
use crate::portfolio::{is_trading_hours, PortfolioSnapshot};

#[derive(Debug, Clone, Serialize)]
pub struct PushChannelResult {
    pub channel: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PushResponse {
    pub status: String,
    pub message: String,
    pub results: Vec<PushChannelResult>,
}

fn validate_feishu(cfg: &Value) -> Vec<String> {
    let mut issues = Vec::new();
    if !is_channel_active(cfg) {
        return vec!["请至少启用群机器人或应用".to_string()];
    }
    if webhook_enabled(cfg) {
        let url = trim_str(cfg.get("webhook").and_then(|w| w.get("url")));
        if url.is_empty() {
            issues.push("群机器人：Webhook 未填写".to_string());
        } else if !url.starts_with("https://") {
            issues.push("群机器人：Webhook 需以 https:// 开头".to_string());
        }
    }
    if app_enabled(cfg) {
        let app = cfg.get("app").unwrap_or(&Value::Null);
        if trim_str(app.get("appId")).is_empty() {
            issues.push("应用：App ID 未填写".to_string());
        }
        if trim_str(app.get("appSecret")).is_empty() {
            issues.push("应用：App Secret 未填写".to_string());
        }
        if !has_feishu_app_delivery(app) {
            issues.push("应用：请选择投递会话，或点击「创建专属通知群」".to_string());
        }
    }
    issues
}

fn validate_dingtalk(cfg: &Value) -> Vec<String> {
    let mut issues = Vec::new();
    if !is_channel_active(cfg) {
        return vec!["请至少启用群机器人或应用".to_string()];
    }
    if webhook_enabled(cfg) {
        let url = trim_str(cfg.get("webhook").and_then(|w| w.get("url")));
        if url.is_empty() {
            issues.push("群机器人：Webhook 未填写".to_string());
        } else if !url.starts_with("https://") {
            issues.push("群机器人：Webhook 需以 https:// 开头".to_string());
        }
    }
    if app_enabled(cfg) {
        let app = cfg.get("app").unwrap_or(&Value::Null);
        if trim_str(app.get("clientId")).is_empty() {
            issues.push("应用：Client ID 未填写".to_string());
        }
        if trim_str(app.get("clientSecret")).is_empty() {
            issues.push("应用：Client Secret 未填写".to_string());
        }
    }
    issues
}

fn validate_wecom(cfg: &Value) -> Vec<String> {
    let mut issues = Vec::new();
    if !is_channel_active(cfg) {
        return vec!["请至少启用群机器人或应用".to_string()];
    }
    if webhook_enabled(cfg) {
        let key = trim_str(cfg.get("webhook").and_then(|w| w.get("webhookKey")));
        if key.is_empty() {
            issues.push("群机器人：Webhook Key 未填写".to_string());
        }
    }
    if app_enabled(cfg) {
        let app = cfg.get("app").unwrap_or(&Value::Null);
        if trim_str(app.get("corpId")).is_empty() {
            issues.push("应用：Corp ID 未填写".to_string());
        }
        if trim_str(app.get("corpSecret")).is_empty() {
            issues.push("应用：Corp Secret 未填写".to_string());
        }
        if trim_str(app.get("agentId")).is_empty() {
            issues.push("应用：Agent ID 未填写".to_string());
        }
    }
    issues
}

fn validate_channel_for_test(channel: &str, cfg: &Value) -> Vec<String> {
    match channel {
        "feishu" => validate_feishu(cfg),
        "dingtalk" => validate_dingtalk(cfg),
        "wecom" => validate_wecom(cfg),
        _ => vec!["未知渠道".to_string()],
    }
}

fn validate_channel(channel: &str, cfg: &Value) -> Vec<String> {
    validate_channel_for_test(channel, cfg)
}

async fn dispatch_channel_push(
    channel: &str,
    cfg: &Value,
    snapshot: &PortfolioSnapshot,
    text: &str,
) -> Vec<(String, bool, String)> {
    let mut results = Vec::new();

    match channel {
        "feishu" => {
            let card = build_portfolio_feishu_card(snapshot);
            if webhook_enabled(cfg) {
                let webhook = cfg.get("webhook").unwrap_or(&Value::Null);
                match send_feishu_webhook_card(webhook, &card).await {
                    Ok((ok, msg)) => results.push(("群机器人".to_string(), ok, msg)),
                    Err(err) => results.push(("群机器人".to_string(), false, err)),
                }
            }
            if app_enabled(cfg) {
                let app = cfg.get("app").unwrap_or(&Value::Null);
                match send_feishu_app_card(app, &card).await {
                    Ok((ok, msg)) => results.push(("应用".to_string(), ok, msg)),
                    Err(err) => results.push(("应用".to_string(), false, err)),
                }
            }
        }
        _ => {
            if webhook_enabled(cfg) {
                match send_channel_webhook(channel, cfg, text).await {
                    Ok((ok, msg)) => results.push(("群机器人".to_string(), ok, msg)),
                    Err(err) => results.push(("群机器人".to_string(), false, err.to_string())),
                }
            }
            if app_enabled(cfg) {
                results.push((
                    "应用".to_string(),
                    false,
                    "桌面端暂未实现该渠道的应用模式推送".to_string(),
                ));
            }
        }
    }

    results
}

fn should_skip_push(config: &Value, trading: bool) -> Option<String> {
    if !config_enabled(config) {
        return Some("通知未启用".to_string());
    }
    if config
        .get("trigger")
        .and_then(|t| t.get("tradingHoursOnly"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
        && !trading
    {
        return Some("非交易时段，已跳过推送".to_string());
    }
    None
}

pub async fn push_portfolio_notification(
    config: &Value,
    snapshot: &PortfolioSnapshot,
) -> PushResponse {
    let trading = snapshot.trading;
    if let Some(reason) = should_skip_push(config, trading) {
        eprintln!("[notify-push] skipped: {reason}");
        return PushResponse {
            status: "skipped".to_string(),
            message: reason,
            results: vec![],
        };
    }

    if !includes_portfolio(config) {
        return PushResponse {
            status: "skipped".to_string(),
            message: "未勾选持仓收益通知".to_string(),
            results: vec![],
        };
    }

    let text = build_portfolio_notification(snapshot);
    let channels = ["dingtalk", "feishu", "wecom"];
    let mut results = Vec::new();
    let mut success_count = 0usize;
    let mut active_count = 0usize;

    for channel in channels {
        let Some(cfg) = channel_cfg(config, channel) else {
            continue;
        };
        if !is_channel_push_active(config, channel) {
            continue;
        }
        active_count += 1;

        let issues = validate_channel(channel, cfg);
        if !issues.is_empty() {
            results.push(PushChannelResult {
                channel: channel.to_string(),
                status: "error".to_string(),
                message: issues.join("；"),
            });
            continue;
        }

        let mode_results = dispatch_channel_push(channel, cfg, snapshot, &text).await;
        let failures: Vec<String> = mode_results
            .iter()
            .filter(|(_, ok, _)| !ok)
            .map(|(mode, _, msg)| format!("{mode}：{msg}"))
            .collect();

        if failures.is_empty() {
            success_count += 1;
            let summary = mode_results
                .iter()
                .map(|(mode, _, msg)| format!("{mode}：{msg}"))
                .collect::<Vec<_>>()
                .join("；");
            results.push(PushChannelResult {
                channel: channel.to_string(),
                status: "success".to_string(),
                message: summary,
            });
        } else {
            results.push(PushChannelResult {
                channel: channel.to_string(),
                status: "error".to_string(),
                message: failures.join("；"),
            });
        }
    }

    if active_count == 0 {
        eprintln!("[notify-push] skipped: 没有启用的通知渠道");
        return PushResponse {
            status: "skipped".to_string(),
            message: "没有启用的通知渠道".to_string(),
            results,
        };
    }

    let status = if success_count == active_count {
        "success"
    } else if success_count > 0 {
        "partial"
    } else {
        "error"
    };

    PushResponse {
        status: status.to_string(),
        message: format!("推送完成（{success_count}/{active_count} 渠道成功）"),
        results,
    }
}

pub async fn test_channel_connectivity(
    channel: &str,
    config: &Value,
    snapshot: Option<&PortfolioSnapshot>,
) -> ConnectivityTestResponse {
    if !config_enabled(config) {
        return ConnectivityTestResponse {
            status: "error".to_string(),
            message: "请先开启「启用消息通知」".to_string(),
            details: vec![],
        };
    }

    let Some(cfg) = channel_cfg(config, channel) else {
        return ConnectivityTestResponse {
            status: "error".to_string(),
            message: "渠道配置缺失".to_string(),
            details: vec![],
        };
    };

    if !is_channel_active(cfg) {
        return ConnectivityTestResponse {
            status: "error".to_string(),
            message: "请至少启用群机器人或应用".to_string(),
            details: vec![],
        };
    }

    let issues = validate_channel_for_test(channel, cfg);
    if !issues.is_empty() {
        return ConnectivityTestResponse {
            status: "error".to_string(),
            message: "配置未通过校验".to_string(),
            details: issues,
        };
    }

    let card = build_connectivity_test_card(snapshot);
    let text = build_connectivity_test_message(snapshot);
    let mut details = Vec::new();
    let mut failures = Vec::new();

    match channel {
        "feishu" => {
            if webhook_enabled(cfg) {
                let webhook = cfg.get("webhook").unwrap_or(&Value::Null);
                match send_feishu_webhook_card(webhook, &card).await {
                    Ok((true, msg)) => details.push(format!("群机器人：{msg}")),
                    Ok((false, msg)) => failures.push(format!("群机器人：{msg}")),
                    Err(err) => failures.push(format!("群机器人：{err}")),
                }
            }
            if app_enabled(cfg) {
                let app = cfg.get("app").unwrap_or(&Value::Null);
                match send_feishu_app_card(app, &card).await {
                    Ok((true, msg)) => details.push(format!("应用：{msg}")),
                    Ok((false, msg)) => failures.push(format!("应用：{msg}")),
                    Err(err) => failures.push(format!("应用：{err}")),
                }
            }
        }
        _ => {
            if webhook_enabled(cfg) {
                match send_channel_webhook(channel, cfg, &text).await {
                    Ok((true, msg)) => details.push(format!("群机器人：{msg}")),
                    Ok((false, msg)) => failures.push(format!("群机器人：{msg}")),
                    Err(err) => failures.push(format!("群机器人：{err}")),
                }
            }
            if app_enabled(cfg) {
                failures.push("应用：桌面端暂未实现该渠道的应用模式连通性测试".to_string());
            }
        }
    }

    if !failures.is_empty() {
        return ConnectivityTestResponse {
            status: "error".to_string(),
            message: "连通性测试未通过".to_string(),
            details: failures.into_iter().chain(details).collect(),
        };
    }

    if details.is_empty() {
        return ConnectivityTestResponse {
            status: "error".to_string(),
            message: "没有可测试的接入方式".to_string(),
            details: vec![],
        };
    }

    ConnectivityTestResponse {
        status: "success".to_string(),
        message: "连通性测试通过".to_string(),
        details,
    }
}

pub fn should_run_scheduled_push(config: &Value, last_push_ms: i64) -> bool {
    if !config_enabled(config) {
        return false;
    }
    let freq = crate::notify::config::frequency(config);
    let Some(interval) = crate::notify::config::frequency_interval_ms(freq) else {
        return false;
    };
    if crate::notify::config::trading_hours_only(config) && !is_trading_hours() {
        return false;
    }
    let now = chrono::Utc::now().timestamp_millis();
    now - last_push_ms >= interval
}

pub fn should_run_manual_push(config: &Value) -> bool {
    config_enabled(config) && crate::notify::config::frequency(config) == "manual"
}
