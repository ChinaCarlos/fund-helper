use std::collections::HashMap;
use std::sync::OnceLock;

use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;

use crate::error::{AppError, AppResult};

const YJB_BASE_URL: &str = "http://browser-plug-api.yangjibao.com";
const YJB_API_SECRET: &str = "YxmKSrQR4uoJ5lOoWIhcbd7SlUEh9OOc";

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

fn shared_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .pool_max_idle_per_host(8)
            .tcp_keepalive(std::time::Duration::from_secs(30))
            .build()
            .expect("reqwest client")
    })
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct QrCreateResult {
    pub id: String,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize)]
pub struct QrStateResult {
    pub state: Value,
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub nickname: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
}

pub struct YjbClient {
    client: Client,
    token: String,
}

impl YjbClient {
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            client: shared_client().clone(),
            token: token.into(),
        }
    }

    fn sign(path: &str, token: &str, timestamp: i64) -> String {
        format!(
            "{:x}",
            md5::compute(format!("{path}{token}{timestamp}{YJB_API_SECRET}"))
        )
    }

    async fn request<T: for<'de> Deserialize<'de>>(
        &self,
        method: reqwest::Method,
        path: &str,
        params: Option<Vec<(String, String)>>,
    ) -> AppResult<T> {
        let timestamp = chrono::Utc::now().timestamp();
        let mut url = reqwest::Url::parse(&format!("{YJB_BASE_URL}{path}"))
            .map_err(|e| AppError::msg(e.to_string()))?;

        if let Some(items) = params {
            for (key, value) in items {
                url.query_pairs_mut().append_pair(&key, &value);
            }
        }

        let response = self
            .client
            .request(method, url)
            .header("Content-Type", "application/json")
            .header("Authorization", &self.token)
            .header("Request-Time", timestamp.to_string())
            .header("Request-Sign", Self::sign(path, &self.token, timestamp))
            .send()
            .await?;

        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(AppError::Unauthorized);
        }

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(AppError::RateLimited);
        }

        let payload: Value = response
            .json()
            .await
            .map_err(|_| AppError::msg("响应解析失败"))?;

        let code = payload.get("code").and_then(|v| v.as_i64()).unwrap_or(-1);
        if code != 200 {
            let message = payload
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("养基宝请求失败")
                .to_string();
            if message.contains("token") || message.contains("登录") || message.contains("授权") {
                return Err(AppError::Unauthorized);
            }
            return Err(AppError::msg(message));
        }

        let data = payload
            .get("data")
            .cloned()
            .ok_or_else(|| AppError::msg("响应缺少 data"))?;

        serde_json::from_value(data).map_err(|e| AppError::msg(e.to_string()))
    }

    pub async fn get_qrcode(&self) -> AppResult<QrCreateResult> {
        self.request(reqwest::Method::GET, "/qr_code", None).await
    }

    pub async fn get_qrcode_state(&self, qr_id: &str) -> AppResult<QrStateResult> {
        self.request(
            reqwest::Method::GET,
            &format!("/qr_code_state/{qr_id}"),
            None,
        )
        .await
    }

    pub async fn get_collect(&self) -> AppResult<Value> {
        self.request(reqwest::Method::GET, "/account_collect", None)
            .await
    }

    pub async fn get_funds(&self, account_id: i64) -> AppResult<Vec<Value>> {
        self.request(
            reqwest::Method::GET,
            "/fund_hold",
            Some(vec![("account_id".into(), account_id.to_string())]),
        )
        .await
    }

    pub async fn get_index(&self) -> AppResult<HashMap<String, Value>> {
        self.request(reqwest::Method::GET, "/index_data", None)
            .await
    }

    pub async fn get_income_line_data(
        &self,
        collect: bool,
        account_ids: &[i64],
    ) -> AppResult<Value> {
        if collect || account_ids.is_empty() {
            return self
                .request(
                    reqwest::Method::GET,
                    "/income_line_data",
                    Some(vec![
                        ("date_type".into(), "day".into()),
                        ("collect".into(), "true".into()),
                    ]),
                )
                .await;
        }

        let mut params = vec![("date_type".into(), "day".into())];
        for id in account_ids {
            params.push(("account_ids[]".into(), id.to_string()));
        }
        self.request(reqwest::Method::GET, "/income_line_data", Some(params))
            .await
    }
}
