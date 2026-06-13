use reqwest::Client;
use serde_json::Value;

use crate::notify::config::trim_str;
use crate::notify::feishu_card::{feishu_im_payload, feishu_webhook_payload};
use crate::notify::webhook::feishu_sign_headers;

const HTTP_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(20);

struct DeliveryTarget {
    receive_id: String,
    receive_id_type: String,
}

fn client() -> Client {
    Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .expect("feishu app client")
}

fn is_ok(data: &Value) -> bool {
    if data.get("ok") == Some(&serde_json::json!(true)) {
        return true;
    }
    match data.get("code").or_else(|| data.get("errcode")) {
        None => true,
        Some(Value::Number(n)) => n.as_i64() == Some(0),
        Some(Value::String(s)) => s == "0",
        _ => false,
    }
}

fn parse_error(data: Option<&Value>, fallback: &str) -> String {
    if let Some(data) = data {
        for key in ["msg", "message", "errmsg"] {
            if let Some(value) = data.get(key).and_then(|v| v.as_str()) {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
    }
    fallback.to_string()
}

async fn read_json(response: reqwest::Response) -> Result<(reqwest::StatusCode, Value), String> {
    let status = response.status();
    let data: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok((status, data))
}

pub async fn feishu_tenant_token(app_id: &str, app_secret: &str) -> Result<String, String> {
    let response = client()
        .post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal")
        .json(&serde_json::json!({
            "app_id": app_id,
            "app_secret": app_secret,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let (status, data) = read_json(response).await?;
    if !status.is_success() || !is_ok(&data) {
        return Err(parse_error(Some(&data), "获取飞书 token 失败"));
    }
    let token = data
        .get("tenant_access_token")
        .or_else(|| data.get("data").and_then(|d| d.get("tenant_access_token")))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if token.is_empty() {
        return Err("飞书 token 响应为空".to_string());
    }
    Ok(token.to_string())
}

pub fn has_feishu_app_delivery(app: &Value) -> bool {
    !resolve_feishu_deliveries(app).is_empty()
}

fn resolve_feishu_deliveries(app: &Value) -> Vec<DeliveryTarget> {
    let mut ids = Vec::new();
    if let Some(arr) = app.get("receiveChatIds").and_then(|v| v.as_array()) {
        for item in arr {
            let id = trim_str(Some(item));
            if !id.is_empty() && !ids.contains(&id) {
                ids.push(id);
            }
        }
    }
    let legacy = trim_str(app.get("receiveChatId"));
    if !legacy.is_empty() && !ids.contains(&legacy) {
        ids.insert(0, legacy);
    }
    ids.into_iter()
        .map(|receive_id| DeliveryTarget {
            receive_id,
            receive_id_type: "chat_id".to_string(),
        })
        .collect()
}

pub async fn send_feishu_webhook_card(webhook: &Value, card: &Value) -> Result<(bool, String), String> {
    let url = trim_str(webhook.get("url"));
    if url.is_empty() {
        return Ok((false, "Webhook 未填写".to_string()));
    }
    let secret = trim_str(webhook.get("signingSecret"));
    let headers = if secret.is_empty() {
        None
    } else {
        Some(feishu_sign_headers(&secret))
    };

    let mut request = client()
        .post(&url)
        .json(&feishu_webhook_payload(card));
    if let Some(headers) = headers {
        request = request.headers(headers);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    let (status, data) = read_json(response).await?;
    if status.is_success() && is_ok(&data) {
        Ok((true, "飞书消息卡片已发送".to_string()))
    } else {
        Ok((false, parse_error(Some(&data), "远程接口返回失败")))
    }
}

pub async fn send_feishu_app_card(app: &Value, card: &Value) -> Result<(bool, String), String> {
    let app_id = trim_str(app.get("appId"));
    let app_secret = trim_str(app.get("appSecret"));
    if app_id.is_empty() || app_secret.is_empty() {
        return Ok((false, "App ID 或 App Secret 未填写".to_string()));
    }

    let targets = resolve_feishu_deliveries(app);
    if targets.is_empty() {
        return Ok((false, "请选择投递会话或填写 Open ID".to_string()));
    }

    let token = feishu_tenant_token(&app_id, &app_secret).await?;
    let body = feishu_im_payload(card);
    let mut successes = 0usize;
    let mut failures = Vec::new();

    for target in targets {
        let url = format!(
            "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type={}",
            target.receive_id_type
        );
        let payload = serde_json::json!({
            "receive_id": target.receive_id,
            "msg_type": body.get("msg_type").cloned().unwrap_or(Value::String("interactive".into())),
            "content": body.get("content").cloned().unwrap_or_else(|| card.to_string().into()),
        });

        let response = client()
            .post(&url)
            .header("Authorization", format!("Bearer {token}"))
            .json(&payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let (status, data) = read_json(response).await?;
        let short_id = if target.receive_id.len() > 12 {
            format!("{}…", &target.receive_id[..12])
        } else {
            target.receive_id.clone()
        };

        if status.is_success() && is_ok(&data) {
            successes += 1;
        } else {
            failures.push(format!(
                "{}（{}）：{}",
                target.receive_id_type,
                short_id,
                parse_error(Some(&data), "发送失败")
            ));
        }
    }

    if successes > 0 && failures.is_empty() {
        Ok((true, format!("已发送 {successes} 条消息")))
    } else if successes > 0 {
        Ok((
            true,
            format!("部分成功（{successes}/{}）：{}", successes + failures.len(), failures.join("；")),
        ))
    } else {
        Ok((false, failures.join("；")))
    }
}
