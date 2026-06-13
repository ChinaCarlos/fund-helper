use reqwest::Client;
use serde::Serialize;
use serde_json::Value;

use crate::notify::config::trim_str;

const HTTP_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(20);
const MAX_CHATS: usize = 100;

#[derive(Debug, Clone, Serialize)]
pub struct DeliveryChatOption {
    pub id: String,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeliveryTargetsResponse {
    pub status: String,
    pub message: String,
    pub chats: Vec<DeliveryChatOption>,
}

fn client() -> Client {
    Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .expect("delivery catalog client")
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

async fn read_json(response: reqwest::Response) -> Result<(reqwest::StatusCode, Value), String> {
    let status = response.status();
    let data: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok((status, data))
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

async fn feishu_tenant_token(app_id: &str, app_secret: &str) -> Result<String, String> {
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

async fn list_feishu_chats(app_id: &str, app_secret: &str) -> Result<(Vec<DeliveryChatOption>, String), String> {
    let token = feishu_tenant_token(app_id, app_secret).await?;
    let mut groups = Vec::new();
    let mut page_token = String::new();

    while groups.len() < MAX_CHATS {
        let mut req = client()
            .get("https://open.feishu.cn/open-apis/im/v1/chats")
            .header("Authorization", format!("Bearer {token}"))
            .query(&[("page_size", std::cmp::min(50, MAX_CHATS - groups.len()).to_string())]);
        if !page_token.is_empty() {
            req = req.query(&[("page_token", page_token.clone())]);
        }

        let response = req.send().await.map_err(|e| e.to_string())?;
        let (status, data) = read_json(response).await?;
        if !status.is_success() || !is_ok(&data) {
            if groups.is_empty() {
                return Err(parse_error(
                    Some(&data),
                    "拉取飞书群列表失败，请确认应用已加入目标群并开通 im:chat 权限",
                ));
            }
            break;
        }

        let body = data.get("data").unwrap_or(&Value::Null);
        if let Some(items) = body.get("items").and_then(|v| v.as_array()) {
            for item in items {
                let chat_id = trim_str(item.get("chat_id"));
                if chat_id.is_empty() {
                    continue;
                }
                let name = trim_str(item.get("name"));
                let name = if name.is_empty() { chat_id.clone() } else { name };
                groups.push(DeliveryChatOption {
                    id: chat_id,
                    name,
                    kind: "group".to_string(),
                });
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

    let message = if groups.is_empty() {
        "未找到机器人所在的群，可点击「创建专属通知群」新建，或先把机器人拉入目标群后刷新".to_string()
    } else {
        format!(
            "已加载 {} 个群；也可点击「创建专属通知群」新建两人通知群",
            groups.len()
        )
    };
    Ok((groups, message))
}

async fn dingtalk_access_token(client_id: &str, client_secret: &str) -> Result<String, String> {
    let response = client()
        .get("https://oapi.dingtalk.com/gettoken")
        .query(&[("appkey", client_id), ("appsecret", client_secret)])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let (status, data) = read_json(response).await?;
    if !status.is_success() || !is_ok(&data) {
        return Err(parse_error(Some(&data), "获取钉钉 token 失败"));
    }
    let token = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if token.is_empty() {
        return Err("钉钉 token 响应为空".to_string());
    }
    Ok(token.to_string())
}

async fn list_dingtalk_chats(
    client_id: &str,
    client_secret: &str,
) -> Result<(Vec<DeliveryChatOption>, String), String> {
    let token = dingtalk_access_token(client_id, client_secret).await?;
    let response = client()
        .post("https://api.dingtalk.com/v1.0/im/sceneGroups/query")
        .header("x-acs-dingtalk-access-token", &token)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "maxResults": MAX_CHATS }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let (status, data) = read_json(response).await?;
    if !status.is_success() {
        return Err(parse_error(
            Some(&data),
            "拉取钉钉会话失败，请确认应用权限或先在目标群添加机器人",
        ));
    }

    let groups = data
        .get("result")
        .or_else(|| data.get("groups"))
        .or_else(|| data.get("items"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut chats = Vec::new();
    for item in groups {
        let chat_id = ["openConversationId", "conversationId", "chatId", "cid"]
            .iter()
            .find_map(|key| item.get(*key).and_then(|v| v.as_str()))
            .map(str::trim)
            .unwrap_or("");
        if chat_id.is_empty() {
            continue;
        }
        let name = ["title", "name", "groupName"]
            .iter()
            .find_map(|key| item.get(*key).and_then(|v| v.as_str()))
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(chat_id);
        chats.push(DeliveryChatOption {
            id: chat_id.to_string(),
            name: name.to_string(),
            kind: "group".to_string(),
        });
    }

    let message = if chats.is_empty() {
        "未找到钉钉会话，请先把机器人加入目标群并开通 IM 相关权限后刷新".to_string()
    } else {
        format!("已加载 {} 个钉钉会话", chats.len())
    };
    Ok((chats, message))
}

async fn wecom_access_token(corp_id: &str, corp_secret: &str) -> Result<String, String> {
    let response = client()
        .get("https://qyapi.weixin.qq.com/cgi-bin/gettoken")
        .query(&[("corpid", corp_id), ("corpsecret", corp_secret)])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let (status, data) = read_json(response).await?;
    if !status.is_success() || !is_ok(&data) {
        return Err(parse_error(Some(&data), "获取企业微信 token 失败"));
    }
    let token = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if token.is_empty() {
        return Err("企业微信 token 响应为空".to_string());
    }
    Ok(token.to_string())
}

async fn list_wecom_chats(
    corp_id: &str,
    corp_secret: &str,
) -> Result<(Vec<DeliveryChatOption>, String), String> {
    let token = wecom_access_token(corp_id, corp_secret).await?;
    let url = format!(
        "https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/list?access_token={token}"
    );
    let response = client()
        .post(&url)
        .json(&serde_json::json!({ "limit": std::cmp::min(MAX_CHATS, 100) }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let (status, data) = read_json(response).await?;
    if !status.is_success() || !is_ok(&data) {
        return Err(parse_error(
            Some(&data),
            "拉取企业微信会话失败；内部群请优先用 Webhook，或在高级选项手填 chatid",
        ));
    }

    let mut chats = Vec::new();
    if let Some(items) = data.get("group_chat_list").and_then(|v| v.as_array()) {
        for item in items {
            let chat_id = trim_str(item.get("chat_id"));
            if chat_id.is_empty() {
                continue;
            }
            let name = trim_str(item.get("name"));
            let name = if name.is_empty() { chat_id.clone() } else { name };
            chats.push(DeliveryChatOption {
                id: chat_id,
                name,
                kind: "group".to_string(),
            });
        }
    }

    let message = if chats.is_empty() {
        "未找到可推送的客户群；内部应用群请用 Webhook 或高级选项手填 chatid".to_string()
    } else {
        format!("已加载 {} 个企业微信会话", chats.len())
    };
    Ok((chats, message))
}

fn feishu_app(config: &Value) -> Option<&Value> {
    config
        .get("channels")
        .and_then(|c| c.get("feishu"))
        .and_then(|f| f.get("app"))
}

fn dingtalk_app(config: &Value) -> Option<&Value> {
    config
        .get("channels")
        .and_then(|c| c.get("dingtalk"))
        .and_then(|f| f.get("app"))
}

fn wecom_app(config: &Value) -> Option<&Value> {
    config
        .get("channels")
        .and_then(|c| c.get("wecom"))
        .and_then(|f| f.get("app"))
}

pub async fn list_delivery_chats(channel: &str, config: &Value) -> DeliveryTargetsResponse {
    let result: Result<(Vec<DeliveryChatOption>, String), String> = match channel {
        "feishu" => {
            let app = feishu_app(config);
            let app_id = app.map(|a| trim_str(a.get("appId"))).unwrap_or_default();
            let app_secret = app.map(|a| trim_str(a.get("appSecret"))).unwrap_or_default();
            if app_id.is_empty() || app_secret.is_empty() {
                return DeliveryTargetsResponse {
                    status: "error".to_string(),
                    message: "请先填写飞书 App ID 与 App Secret".to_string(),
                    chats: vec![],
                };
            }
            list_feishu_chats(&app_id, &app_secret).await
        }
        "dingtalk" => {
            let app = dingtalk_app(config);
            let client_id = app.map(|a| trim_str(a.get("clientId"))).unwrap_or_default();
            let client_secret = app
                .map(|a| trim_str(a.get("clientSecret")))
                .unwrap_or_default();
            if client_id.is_empty() || client_secret.is_empty() {
                return DeliveryTargetsResponse {
                    status: "error".to_string(),
                    message: "请先填写钉钉 Client ID 与 Client Secret".to_string(),
                    chats: vec![],
                };
            }
            list_dingtalk_chats(&client_id, &client_secret).await
        }
        "wecom" => {
            let app = wecom_app(config);
            let corp_id = app.map(|a| trim_str(a.get("corpId"))).unwrap_or_default();
            let corp_secret = app.map(|a| trim_str(a.get("corpSecret"))).unwrap_or_default();
            if corp_id.is_empty() || corp_secret.is_empty() {
                return DeliveryTargetsResponse {
                    status: "error".to_string(),
                    message: "请先填写企业微信 Corp ID 与 Corp Secret".to_string(),
                    chats: vec![],
                };
            }
            list_wecom_chats(&corp_id, &corp_secret).await
        }
        _ => Err("未知渠道".to_string()),
    };

    match result {
        Ok((chats, message)) => DeliveryTargetsResponse {
            status: if chats.is_empty() {
                "error".to_string()
            } else {
                "success".to_string()
            },
            message,
            chats,
        },
        Err(message) => DeliveryTargetsResponse {
            status: "error".to_string(),
            message,
            chats: vec![],
        },
    }
}
