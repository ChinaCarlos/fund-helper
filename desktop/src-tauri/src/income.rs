use std::collections::HashMap;

use serde::Serialize;
use serde_json::Value;

use crate::portfolio::to_float;

#[derive(Debug, Clone, Serialize)]
pub struct IncomeLinePoint {
    pub label: String,
    pub rate: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct IncomeLineData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_id: Option<i64>,
    pub day: String,
    pub today_income: f64,
    pub points: Vec<IncomeLinePoint>,
}

fn extract_block<'a>(data: &'a Value, account_id: Option<i64>) -> &'a Value {
    if let Some(id) = account_id {
        if let Some(block) = data.get(id.to_string()) {
            return block;
        }
    } else if let Some(collect) = data.get("collect") {
        return collect;
    } else if data.as_object().map(|m| m.len()) == Some(1) {
        if let Some(v) = data.as_object().and_then(|m| m.values().next()) {
            return v;
        }
    } else if let Some(collect) = data.get("collect") {
        return collect;
    }
    data
}

pub fn normalize_income_line(data: &Value, account_id: Option<i64>) -> IncomeLineData {
    let block = extract_block(data, account_id);
    let block_obj = block.as_object();

    let mut points = Vec::new();
    if let Some(list) = block_obj.and_then(|o| o.get("line_list")).and_then(|v| v.as_array()) {
        for item in list {
            let label = item
                .get("time")
                .or_else(|| item.get("date"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            points.push(IncomeLinePoint {
                label,
                rate: to_float(item.get("rate"), 0.0),
            });
        }
    }

    IncomeLineData {
        account_id,
        day: block_obj
            .and_then(|o| o.get("day"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        today_income: block_obj
            .map(|o| to_float(o.get("today_income"), 0.0))
            .unwrap_or(0.0),
        points,
    }
}

pub fn normalize_income_lines(data: &Value, account_ids: &[i64]) -> HashMap<String, IncomeLineData> {
    account_ids
        .iter()
        .map(|id| (id.to_string(), normalize_income_line(data, Some(*id))))
        .collect()
}
