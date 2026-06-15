use std::collections::HashMap;

use chrono::{Datelike, Local, Timelike};
use serde::Serialize;
use serde_json::Value;

use crate::error::AppResult;
use crate::yjb::YjbClient;

#[derive(Debug, Clone, Serialize)]
pub struct FundNvInfo {
    pub dwjz: f64,
    pub gzjz: f64,
    pub gszzl: f64,
    pub jzzzl: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FundItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<i64>,
    pub code: String,
    pub short_name: String,
    pub money: f64,
    pub hold_sum: f64,
    pub hold_earn: f64,
    pub day_earn: f64,
    pub day_rate: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nv_info: Option<FundNvInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AccountItem {
    pub account_id: i64,
    pub title: String,
    pub today_income: f64,
    pub today_income_rate: f64,
    pub hold_income: f64,
    pub hold_income_rate: f64,
    pub account_assets: f64,
    pub up: i64,
    pub down: i64,
    pub funds: Vec<FundItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndexItem {
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub v: Option<String>,
    pub dir: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PortfolioSnapshot {
    pub total_assets: f64,
    pub today_income: f64,
    pub today_income_rate: f64,
    pub rise_count: i64,
    pub fall_count: i64,
    pub accounts: Vec<AccountItem>,
    pub funds: Vec<FundItem>,
    pub indices: Vec<IndexItem>,
    pub updated_at: String,
    pub trading: bool,
}

pub(crate) fn to_float(value: Option<&Value>, fallback: f64) -> f64 {
    match value {
        None | Some(Value::Null) => fallback,
        Some(Value::Number(n)) => n.as_f64().unwrap_or(fallback),
        Some(Value::String(s)) => s.parse().unwrap_or(fallback),
        _ => fallback,
    }
}

fn obj(value: &Value) -> Option<&serde_json::Map<String, Value>> {
    value.as_object()
}

fn normalize_index_dir(dir_val: f64, div_val: f64) -> f64 {
    if dir_val == 0.0 {
        return 0.0;
    }
    let abs_dir = dir_val.abs();
    if div_val > 0.0 {
        abs_dir
    } else if div_val < 0.0 {
        -abs_dir
    } else {
        dir_val
    }
}

fn pick_first_float(nv: &serde_json::Map<String, Value>, keys: &[&str]) -> f64 {
    for key in keys {
        if let Some(val) = nv.get(*key) {
            if val.is_null() {
                continue;
            }
            if let Some(s) = val.as_str() {
                if s.is_empty() {
                    continue;
                }
            }
            let n = to_float(Some(val), 0.0);
            return n;
        }
    }
    0.0
}

fn pick_estimate_rate(nv: &serde_json::Map<String, Value>) -> f64 {
    pick_first_float(nv, &["gszzl", "zsgzzl", "vgszzl"])
}

fn pick_published_rate(nv: &serde_json::Map<String, Value>) -> f64 {
    pick_first_float(nv, &["jzzzl", "rzzl"])
}

fn pick_estimate_nav(nv: &serde_json::Map<String, Value>) -> f64 {
    pick_first_float(nv, &["gzjz", "zsgz", "gsz", "vgsz"])
}

fn pick_rate_for_day_earn(nv: &serde_json::Map<String, Value>) -> f64 {
    let estimate = pick_estimate_rate(nv);
    if estimate != 0.0 {
        return estimate;
    }
    pick_published_rate(nv)
}

fn calc_fund_day_earn(fund: &Value) -> f64 {
    let money = to_float(fund.get("money"), 0.0);
    let nv = fund.get("nv_info").and_then(obj).cloned().unwrap_or_default();
    let rate = pick_rate_for_day_earn(&nv);
    ((money * rate) / 100.0 * 100.0).round() / 100.0
}

fn enrich_fund(fund: &Value, account_id: i64, account_title: &str) -> FundItem {
    let nv_map = fund.get("nv_info").and_then(obj).cloned().unwrap_or_default();
    let gszzl = pick_estimate_rate(&nv_map);
    let jzzzl = pick_published_rate(&nv_map);
    let id = fund.get("id").and_then(|v| v.as_i64());

    FundItem {
        id,
        code: fund
            .get("code")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        short_name: fund
            .get("short_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        money: to_float(fund.get("money"), 0.0),
        hold_sum: to_float(
            fund.get("hold_sum").or(fund.get("money")),
            0.0,
        ),
        hold_earn: to_float(fund.get("hold_earn"), 0.0),
        day_earn: calc_fund_day_earn(fund),
        day_rate: if gszzl != 0.0 { gszzl } else { jzzzl },
        account_id: Some(account_id),
        account_title: Some(account_title.to_string()),
        nv_info: Some(FundNvInfo {
            dwjz: pick_first_float(&nv_map, &["dwjz"]),
            gzjz: pick_estimate_nav(&nv_map),
            gszzl,
            jzzzl,
        }),
    }
}

pub fn is_trading_hours() -> bool {
    let now = Local::now();
    if now.weekday().num_days_from_monday() >= 5 {
        return false;
    }
    let minutes = now.hour() as i32 * 60 + now.minute() as i32;
    (570..=691).contains(&minutes) || (810..=901).contains(&minutes)
}

fn build_portfolio_snapshot(
    collect: Value,
    funds_by_account: HashMap<i64, Vec<Value>>,
    indices: HashMap<String, Value>,
) -> PortfolioSnapshot {
    let account_data = collect
        .get("account_data")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut accounts = Vec::new();
    let mut all_funds = Vec::new();

    for acc in &account_data {
        let account_id = to_float(acc.get("account_id"), 0.0) as i64;
        let title = acc
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let mut funds: Vec<FundItem> = funds_by_account
            .get(&account_id)
            .cloned()
            .unwrap_or_default()
            .iter()
            .map(|f| enrich_fund(f, account_id, &title))
            .collect();
        funds.sort_by(|a, b| {
            b.day_earn
                .abs()
                .partial_cmp(&a.day_earn.abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        all_funds.extend(funds.clone());
        accounts.push(AccountItem {
            account_id,
            title,
            today_income: to_float(acc.get("today_income"), 0.0),
            today_income_rate: to_float(acc.get("today_income_rate"), 0.0),
            hold_income: to_float(acc.get("hold_income"), 0.0),
            hold_income_rate: to_float(acc.get("hold_income_rate"), 0.0),
            account_assets: to_float(acc.get("account_assets"), 0.0),
            up: to_float(acc.get("up"), 0.0) as i64,
            down: to_float(acc.get("down"), 0.0) as i64,
            funds,
        });
    }

    let key_indices = ["1.000001", "1.000300", "0.399001", "0.399006"];
    let mut index_list = Vec::new();
    for code in key_indices {
        if let Some(item) = indices.get(code) {
            index_list.push(IndexItem {
                code: code.to_string(),
                name: item
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map(str::to_string),
                v: item.get("v").and_then(|v| v.as_str()).map(str::to_string),
                dir: normalize_index_dir(
                    to_float(item.get("dir"), 0.0),
                    to_float(item.get("div"), 0.0),
                ),
            });
        }
    }

    all_funds.sort_by(|a, b| {
        b.day_earn
            .abs()
            .partial_cmp(&a.day_earn.abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let rise_count = account_data
        .iter()
        .map(|a| to_float(a.get("up"), 0.0) as i64)
        .sum();
    let fall_count = account_data
        .iter()
        .map(|a| to_float(a.get("down"), 0.0) as i64)
        .sum();

    PortfolioSnapshot {
        total_assets: to_float(collect.get("assets_collect"), 0.0),
        today_income: to_float(collect.get("today_income"), 0.0),
        today_income_rate: to_float(collect.get("today_income_rate"), 0.0),
        rise_count,
        fall_count,
        accounts,
        funds: all_funds,
        indices: index_list,
        updated_at: Local::now().format("%Y/%m/%d %H:%M:%S").to_string(),
        trading: is_trading_hours(),
    }
}

pub async fn fetch_portfolio_snapshot(token: &str) -> AppResult<PortfolioSnapshot> {
    let client = YjbClient::new(token);
    let (collect, indices) = tokio::try_join!(client.get_collect(), client.get_index())?;

    let account_data = collect
        .get("account_data")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut funds_by_account = HashMap::new();
    for acc in account_data {
        let account_id = to_float(acc.get("account_id"), 0.0) as i64;
        let funds = client.get_funds(account_id).await?;
        funds_by_account.insert(account_id, funds);
    }

    Ok(build_portfolio_snapshot(collect, funds_by_account, indices))
}
