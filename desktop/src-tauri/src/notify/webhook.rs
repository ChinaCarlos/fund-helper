use std::time::Duration;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use sha2::Sha256;

use crate::error::AppResult;
use crate::notify::config::trim_str;

type HmacSha256 = Hmac<Sha256>;

const HTTP_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Clone, Serialize)]
pub struct ConnectivityTestResponse {
    pub status: String,
    pub message: String,
    pub details: Vec<String>,
}

fn shared_client() -> Client {
    Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .expect("webhook client")
}

fn dingtalk_sign_url(webhook_url: &str, secret: &str) -> String {
    let timestamp = chrono::Utc::now().timestamp_millis().to_string();
    let string_to_sign = format!("{timestamp}\n{secret}");
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("hmac key");
    mac.update(string_to_sign.as_bytes());
    let digest = BASE64.encode(mac.finalize().into_bytes());
    let sign = urlencoding::encode(&digest);
    let joiner = if webhook_url.contains('?') { "&" } else { "?" };
    format!("{webhook_url}{joiner}timestamp={timestamp}&sign={sign}")
}

pub(crate) fn feishu_sign_headers(secret: &str) -> reqwest::header::HeaderMap {
    let timestamp = chrono::Utc::now().timestamp().to_string();
    let string_to_sign = format!("{timestamp}\n{secret}");
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("hmac key");
    mac.update(string_to_sign.as_bytes());
    let sign = BASE64.encode(mac.finalize().into_bytes());
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        "X-Lark-Request-Timestamp",
        timestamp.parse().expect("timestamp header"),
    );
    headers.insert("X-Lark-Signature", sign.parse().expect("sign header"));
    headers
}

fn parse_remote_error(data: Option<&Value>, fallback: &str) -> String {
    let Some(data) = data else {
        return fallback.to_string();
    };
    for key in ["errmsg", "msg", "message", "error_description", "error"] {
        if let Some(value) = data.get(key).and_then(|v| v.as_str()) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    let code = data.get("errcode").or_else(|| data.get("code"));
    if let Some(code) = code {
        if code != &json!(0) && code != &json!("0") {
            return format!("{fallback}（code={code}）");
        }
    }
    fallback.to_string()
}

fn is_remote_ok(data: &Value) -> bool {
    if data.get("ok") == Some(&json!(true)) {
        return true;
    }
    matches!(
        data.get("errcode").or_else(|| data.get("code")),
        Some(v) if v == &json!(0) || v == &json!("0")
    )
}

async fn post_json(
    client: &Client,
    url: &str,
    payload: Value,
    headers: Option<reqwest::header::HeaderMap>,
) -> (bool, String) {
    let mut request = client.post(url).json(&payload);
    if let Some(headers) = headers {
        request = request.headers(headers);
    }

    let response = match request.send().await {
        Ok(resp) => resp,
        Err(err) if err.is_timeout() => {
            return (false, "请求超时，请检查网络或 Webhook 地址".to_string());
        }
        Err(err) => return (false, format!("网络请求失败：{err}")),
    };

    let status = response.status();
    let data: Option<Value> = response.json().await.ok();

    if status.as_u16() >= 400 {
        return (
            false,
            parse_remote_error(data.as_ref(), &format!("HTTP {}", status.as_u16())),
        );
    }

    if let Some(ref body) = data {
        if !is_remote_ok(body) {
            return (false, parse_remote_error(Some(body), "远程接口返回失败"));
        }
    }

    (true, "ok".to_string())
}

pub async fn send_dingtalk_webhook(webhook: &Value, text: &str) -> (bool, String) {
    let mut url = trim_str(webhook.get("url"));
    if url.is_empty() {
        return (false, "Webhook 未填写".to_string());
    }
    let secret = trim_str(webhook.get("signingSecret"));
    if !secret.is_empty() {
        url = dingtalk_sign_url(&url, &secret);
    }
    let payload = json!({
        "msgtype": "text",
        "text": { "content": text }
    });
    let (ok, detail) = post_json(&shared_client(), &url, payload, None).await;
    if ok {
        (true, "群消息已发送".to_string())
    } else {
        (false, detail)
    }
}

pub async fn send_feishu_webhook(webhook: &Value, text: &str) -> (bool, String) {
    let url = trim_str(webhook.get("url"));
    if url.is_empty() {
        return (false, "Webhook 未填写".to_string());
    }
    let secret = trim_str(webhook.get("signingSecret"));
    let headers = if secret.is_empty() {
        None
    } else {
        Some(feishu_sign_headers(&secret))
    };
    let payload = json!({
        "msg_type": "text",
        "content": { "text": text }
    });
    let (ok, detail) = post_json(&shared_client(), &url, payload, headers).await;
    if ok {
        (true, "飞书消息已发送".to_string())
    } else {
        (false, detail)
    }
}

pub async fn send_wecom_webhook(webhook_key: &str, text: &str) -> (bool, String) {
    if webhook_key.trim().is_empty() {
        return (false, "Webhook Key 未填写".to_string());
    }
    let url = format!(
        "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={}",
        urlencoding::encode(webhook_key.trim())
    );
    let payload = json!({
        "msgtype": "text",
        "text": { "content": text }
    });
    let (ok, detail) = post_json(&shared_client(), &url, payload, None).await;
    if ok {
        (true, "群消息已发送".to_string())
    } else {
        (false, detail)
    }
}

pub async fn send_channel_webhook(channel: &str, cfg: &Value, text: &str) -> AppResult<(bool, String)> {
    match channel {
        "dingtalk" => Ok(send_dingtalk_webhook(cfg.get("webhook").unwrap_or(&Value::Null), text).await),
        "feishu" => Ok(send_feishu_webhook(cfg.get("webhook").unwrap_or(&Value::Null), text).await),
        "wecom" => {
            let key = trim_str(cfg.get("webhook").and_then(|w| w.get("webhookKey")));
            Ok(send_wecom_webhook(&key, text).await)
        }
        _ => Ok((false, "未知渠道".to_string())),
    }
}
