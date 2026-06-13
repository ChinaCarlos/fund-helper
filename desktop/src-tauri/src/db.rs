use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize)]
pub struct AuthStatus {
    pub bound: bool,
    pub nickname: String,
    pub avatar: String,
    pub login_time: String,
}

#[derive(Debug, Clone)]
pub struct SessionStore {
    db_path: PathBuf,
}

impl SessionStore {
    pub fn new(app: &AppHandle) -> AppResult<Self> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| AppError::msg(e.to_string()))?;
        std::fs::create_dir_all(&dir).map_err(|e| AppError::msg(e.to_string()))?;
        let db_path = dir.join("data.db");
        let store = Self { db_path };
        store.init_db()?;
        Ok(store)
    }

    fn conn(&self) -> AppResult<Connection> {
        Connection::open(&self.db_path).map_err(AppError::from)
    }

    fn init_db(&self) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS app_profile (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              nickname TEXT NOT NULL DEFAULT '',
              avatar TEXT NOT NULL DEFAULT '',
              login_time TEXT NOT NULL DEFAULT '',
              yjb_token TEXT NOT NULL DEFAULT ''
            );
            INSERT OR IGNORE INTO app_profile (id) VALUES (1);

            CREATE TABLE IF NOT EXISTS notification_config (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              config_json TEXT NOT NULL DEFAULT '{}',
              updated_at TEXT NOT NULL DEFAULT ''
            );
            INSERT OR IGNORE INTO notification_config (id) VALUES (1);

            CREATE TABLE IF NOT EXISTS push_schedule (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              last_scheduled_push_ms INTEGER NOT NULL DEFAULT 0
            );
            INSERT OR IGNORE INTO push_schedule (id) VALUES (1);
            ",
        )?;
        Self::ensure_token_column(&conn)?;
        Ok(())
    }

    fn ensure_token_column(conn: &Connection) -> AppResult<()> {
        let has_column = conn
            .prepare("PRAGMA table_info(app_profile)")?
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .any(|name| name == "yjb_token");
        if !has_column {
            conn.execute(
                "ALTER TABLE app_profile ADD COLUMN yjb_token TEXT NOT NULL DEFAULT ''",
                [],
            )?;
        }
        Ok(())
    }

    fn save_token(conn: &Connection, token: &str) -> AppResult<()> {
        conn.execute(
            "UPDATE app_profile SET yjb_token = ?1 WHERE id = 1",
            params![token],
        )?;
        Ok(())
    }

    fn load_token(conn: &Connection) -> AppResult<Option<String>> {
        let token: String = conn.query_row(
            "SELECT yjb_token FROM app_profile WHERE id = 1",
            [],
            |row| row.get(0),
        )?;
        if token.is_empty() {
            Ok(None)
        } else {
            Ok(Some(token))
        }
    }

    fn clear_token(conn: &Connection) -> AppResult<()> {
        conn.execute(
            "UPDATE app_profile SET yjb_token = '' WHERE id = 1",
            [],
        )?;
        Ok(())
    }

    pub fn save_session(
        &self,
        token: &str,
        nickname: &str,
        avatar: &str,
        login_time: &str,
    ) -> AppResult<()> {
        let conn = self.conn()?;
        Self::save_token(&conn, token)?;
        conn.execute(
            "UPDATE app_profile SET nickname = ?1, avatar = ?2, login_time = ?3 WHERE id = 1",
            params![nickname, avatar, login_time],
        )?;
        Ok(())
    }

    pub fn auth_status(&self) -> AppResult<AuthStatus> {
        let conn = self.conn()?;
        let token = Self::load_token(&conn)?;
        let (nickname, avatar, login_time): (String, String, String) = conn.query_row(
            "SELECT nickname, avatar, login_time FROM app_profile WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;

        Ok(AuthStatus {
            bound: token.is_some(),
            nickname,
            avatar,
            login_time,
        })
    }

    pub fn require_token(&self) -> AppResult<String> {
        let conn = self.conn()?;
        Self::load_token(&conn)?.ok_or(AppError::msg("未绑定养基宝，请先扫码登录"))
    }

    pub fn clear_session(&self) -> AppResult<()> {
        let conn = self.conn()?;
        Self::clear_token(&conn)?;
        conn.execute(
            "UPDATE app_profile SET nickname = '', avatar = '', login_time = '' WHERE id = 1",
            [],
        )?;
        Ok(())
    }

    pub fn get_notification_config(&self) -> AppResult<String> {
        let conn = self.conn()?;
        let json: String = conn.query_row(
            "SELECT config_json FROM notification_config WHERE id = 1",
            [],
            |row| row.get(0),
        )?;
        Ok(json)
    }

    pub fn save_notification_config(&self, config_json: &str) -> AppResult<()> {
        let conn = self.conn()?;
        let updated_at = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE notification_config SET config_json = ?1, updated_at = ?2 WHERE id = 1",
            params![config_json, updated_at],
        )?;
        Ok(())
    }

    pub fn get_last_scheduled_push_ms(&self) -> AppResult<i64> {
        let conn = self.conn()?;
        conn.query_row(
            "SELECT last_scheduled_push_ms FROM push_schedule WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(AppError::from)
    }

    pub fn set_last_scheduled_push_ms(&self, value: i64) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE push_schedule SET last_scheduled_push_ms = ?1 WHERE id = 1",
            params![value],
        )?;
        Ok(())
    }
}

pub struct AppState {
    pub store: Mutex<SessionStore>,
}

impl AppState {
    pub fn new(app: &AppHandle) -> AppResult<Self> {
        Ok(Self {
            store: Mutex::new(SessionStore::new(app)?),
        })
    }
}
