use serde_json::Value;

pub fn config_enabled(config: &Value) -> bool {
    config.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false)
}

pub fn frequency(config: &Value) -> &str {
    config
        .get("trigger")
        .and_then(|t| t.get("frequency"))
        .and_then(|v| v.as_str())
        .unwrap_or("manual")
}

pub fn trading_hours_only(config: &Value) -> bool {
    config
        .get("trigger")
        .and_then(|t| t.get("tradingHoursOnly"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

pub fn includes_portfolio(config: &Value) -> bool {
    config
        .get("trigger")
        .and_then(|t| t.get("contentTypes"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .any(|item| item.as_str() == Some("portfolio"))
        })
        .unwrap_or(true)
}

pub fn frequency_interval_ms(freq: &str) -> Option<i64> {
    match freq {
        "1m" => Some(60_000),
        "5m" => Some(300_000),
        "15m" => Some(900_000),
        "30m" => Some(1_800_000),
        "60m" => Some(3_600_000),
        _ => None,
    }
}

pub fn trim_str(value: Option<&Value>) -> String {
    value
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("")
        .to_string()
}

pub fn webhook_enabled(channel: &Value) -> bool {
    channel
        .get("webhook")
        .and_then(|w| w.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

pub fn channel_cfg<'a>(config: &'a Value, name: &str) -> Option<&'a Value> {
    config
        .get("channels")
        .and_then(|c| c.get(name))
}

pub fn app_enabled(channel: &Value) -> bool {
    channel
        .get("app")
        .and_then(|a| a.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

pub fn is_channel_push_active(config: &Value, name: &str) -> bool {
    channel_cfg(config, name)
        .map(|ch| is_channel_active(ch))
        .unwrap_or(false)
}

pub fn is_channel_active(channel: &Value) -> bool {
    webhook_enabled(channel) || app_enabled(channel)
}
