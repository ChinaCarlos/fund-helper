use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Message(String),
    #[error("养基宝 Token 已失效，请重新登录")]
    Unauthorized,
    #[error("请求频繁，请稍后再试")]
    RateLimited,
    #[error("网络错误: {0}")]
    Network(#[from] reqwest::Error),
    #[error("数据库错误: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("密钥链错误: {0}")]
    Keyring(#[from] keyring::Error),
}

impl AppError {
    pub fn msg(message: impl Into<String>) -> Self {
        Self::Message(message.into())
    }

    pub fn status_code(&self) -> i32 {
        match self {
            Self::Unauthorized => 401,
            Self::RateLimited => 429,
            _ => 500,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CommandError {
    pub message: String,
    pub status_code: i32,
}

impl From<AppError> for CommandError {
    fn from(value: AppError) -> Self {
        Self {
            message: value.to_string(),
            status_code: value.status_code(),
        }
    }
}

impl From<CommandError> for String {
    fn from(value: CommandError) -> Self {
        value.message
    }
}

pub type AppResult<T> = Result<T, AppError>;
