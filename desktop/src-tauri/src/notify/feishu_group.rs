use reqwest::Client;
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::notify::config::trim_str;

const HTTP_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(20);
const DEFAULT_GROUP_NAME: &str = "华尔街之狼";
const MOBILE_LOOKUP_SCOPE: &str = "contact:user.id:readonly";
const CHAT_CREATE_SCOPE: &str = "im:chat:create";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuCreateGroupResponse {
    pub status: String,
    pub message: String,
    pub chat_id: String,
    pub chat_name: String,
    pub reused: bool,
}

fn client() -> Client {
    Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .expect("feishu group client")
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

fn permission_auth_url(app_id: &str, scope: &str) -> String {
    format!(
        "https://open.feishu.cn/app/{app_id}/auth?q={scope}&op_from=openapi&token_type=tenant"
    )
}

fn permission_denied_message(data: &Value, app_id: &str, scope: &str, label: &str) -> Option<String> {
    let raw = parse_error(Some(data), "");
    let violations = data
        .get("error")
        .and_then(|e| e.get("permission_violations"))
        .and_then(|v| v.as_array());
    let has_scope = violations.is_some_and(|items| {
        items.iter().any(|item| {
            item.get("subject")
                .and_then(|v| v.as_str())
                .is_some_and(|s| s == scope)
        })
    });
    if data.get("code").and_then(|v| v.as_i64()) == Some(99991672)
        || raw.contains(scope)
        || has_scope
    {
        return Some(format!(
            "请先开通「{label}」权限并发布应用：{}",
            permission_auth_url(app_id, scope)
        ));
    }
    None
}

async fn tenant_token(app_id: &str, app_secret: &str) -> Result<String, String> {
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

async fn resolve_open_id_by_mobile(
    token: &str,
    app_id: &str,
    mobile: &str,
) -> Result<String, String> {
    let response = client()
        .post("https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id")
        .query(&[("user_id_type", "open_id")])
        .header("Authorization", format!("Bearer {token}"))
        .json(&serde_json::json!({ "mobiles": [mobile] }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let (status, data) = read_json(response).await?;
    if !status.is_success() || !is_ok(&data) {
        if let Some(msg) = permission_denied_message(&data, app_id, MOBILE_LOOKUP_SCOPE, "通过手机号或邮箱获取用户 ID") {
            return Err(msg);
        }
        return Err(parse_error(
            Some(&data),
            "通过手机号查询用户失败",
        ));
    }

    if let Some(list) = data
        .get("data")
        .and_then(|d| d.get("user_list"))
        .and_then(|v| v.as_array())
    {
        for item in list {
            let open_id = trim_str(item.get("user_id"));
            if open_id.starts_with("ou_") {
                return Ok(open_id);
            }
        }
    }

    Err("未找到该手机号对应的飞书用户，请确认号码已在企业通讯录登记，且应用在通讯录权限范围内".to_string())
}

fn group_uuid(app_id: &str, open_id: &str, group_name: &str) -> String {
    let input = format!("yjb-notify:{app_id}:{open_id}:{group_name}");
    let digest = Sha256::digest(input.as_bytes());
    hex::encode(digest)[..50].to_string()
}

async fn find_group_by_name(token: &str, name: &str) -> Option<String> {
    let mut page_token = String::new();
    loop {
        let mut req = client()
            .get("https://open.feishu.cn/open-apis/im/v1/chats")
            .header("Authorization", format!("Bearer {token}"))
            .query(&[("page_size", "50".to_string())]);
        if !page_token.is_empty() {
            req = req.query(&[("page_token", page_token.clone())]);
        }
        let response = req.send().await.ok()?;
        let (status, data) = read_json(response).await.ok()?;
        if !status.is_success() || !is_ok(&data) {
            return None;
        }
        let body = data.get("data")?;
        if let Some(items) = body.get("items").and_then(|v| v.as_array()) {
            for item in items {
                if trim_str(item.get("name")) == name {
                    let id = trim_str(item.get("chat_id"));
                    if !id.is_empty() {
                        return Some(id);
                    }
                }
            }
        }
        if !body.get("has_more").and_then(|v| v.as_bool()).unwrap_or(false) {
            break;
        }
        page_token = trim_str(body.get("page_token"));
        if page_token.is_empty() {
            break;
        }
    }
    None
}

async fn update_group_name(token: &str, chat_id: &str, name: &str) -> bool {
    let Ok(response) = client()
        .put(format!("https://open.feishu.cn/open-apis/im/v1/chats/{chat_id}"))
        .header("Authorization", format!("Bearer {token}"))
        .json(&serde_json::json!({ "name": name }))
        .send()
        .await
    else {
        return false;
    };
    let status_ok = response.status().is_success();
    let Ok(data) = response.json::<Value>().await else {
        return false;
    };
    status_ok && is_ok(&data)
}

pub async fn create_feishu_notification_group(
    config: &Value,
    mobile: &str,
    group_name: &str,
) -> Result<FeishuCreateGroupResponse, String> {
    let app = config
        .get("channels")
        .and_then(|c| c.get("feishu"))
        .and_then(|f| f.get("app"));
    let app_id = app.map(|a| trim_str(a.get("appId"))).unwrap_or_default();
    let app_secret = app.map(|a| trim_str(a.get("appSecret"))).unwrap_or_default();
    let mobile = mobile.replace(' ', "");
    let group_name = group_name.trim();
    let group_name = if group_name.is_empty() {
        DEFAULT_GROUP_NAME.to_string()
    } else {
        group_name.to_string()
    };

    if app_id.is_empty() || app_secret.is_empty() {
        return Err("请先填写飞书 App ID 与 App Secret".to_string());
    }
    if mobile.is_empty() {
        return Err("请填写手机号".to_string());
    }
    if !regex_mobile(&mobile) {
        return Err("请输入 11 位中国大陆手机号".to_string());
    }

    let token = tenant_token(&app_id, &app_secret).await?;
    let open_id = resolve_open_id_by_mobile(&token, &app_id, &mobile).await?;
    let uuid = group_uuid(&app_id, &open_id, &group_name);

    let response = client()
        .post("https://open.feishu.cn/open-apis/im/v1/chats")
        .query(&[
            ("user_id_type", "open_id"),
            ("uuid", uuid.as_str()),
        ])
        .header("Authorization", format!("Bearer {token}"))
        .json(&serde_json::json!({
            "name": group_name,
            "owner_id": open_id,
            "user_id_list": [open_id],
            "chat_type": "private",
            "join_message_visibility": "not_anyone",
            "leave_message_visibility": "not_anyone",
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let (status, data) = read_json(response).await?;
    if status.is_success() && is_ok(&data) {
        let body = data.get("data").unwrap_or(&Value::Null);
        let chat_id = trim_str(body.get("chat_id"));
        if !chat_id.is_empty() {
            let returned_name = trim_str(body.get("name"));
            let returned_name = if returned_name.is_empty() {
                group_name.clone()
            } else {
                returned_name
            };
            let reused = returned_name != group_name;
            let mut final_name = returned_name.clone();
            let mut message = "专属通知群已就绪".to_string();
            if reused {
                if update_group_name(&token, &chat_id, &group_name).await {
                    final_name = group_name.clone();
                    message = "已复用现有通知群并更新群名称".to_string();
                } else {
                    message = format!(
                        "10 小时内已创建过通知群，当前名称仍为「{returned_name}」；如需新名称请稍后再试或手动改名"
                    );
                }
            }
            return Ok(FeishuCreateGroupResponse {
                status: "success".to_string(),
                message,
                chat_id,
                chat_name: final_name,
                reused,
            });
        }
    }

    if let Some(msg) = permission_denied_message(&data, &app_id, CHAT_CREATE_SCOPE, "创建群") {
        return Err(msg);
    }

    if let Some(existing_id) = find_group_by_name(&token, &group_name).await {
        return Ok(FeishuCreateGroupResponse {
            status: "success".to_string(),
            message: "10 小时内已创建过通知群，已复用现有群组".to_string(),
            chat_id: existing_id,
            chat_name: group_name,
            reused: true,
        });
    }

    Err(parse_error(
        Some(&data),
        &format!(
            "创建通知群失败，请确认已开通「创建群」权限：{}",
            permission_auth_url(&app_id, CHAT_CREATE_SCOPE)
        ),
    ))
}

fn regex_mobile(mobile: &str) -> bool {
    mobile.len() == 11 && mobile.starts_with('1') && mobile.chars().all(|c| c.is_ascii_digit())
}
