use serde_json::{json, Value};

use crate::portfolio::{AccountItem, FundItem, PortfolioSnapshot};
use crate::notify::template::NOTIFY_FOOTER;

pub fn build_portfolio_feishu_card(snapshot: &PortfolioSnapshot) -> Value {
    build_feishu_interactive_card(snapshot, "Fund Helper·持仓收益", "")
}

pub fn build_connectivity_test_card(snapshot: Option<&PortfolioSnapshot>) -> Value {
    if let Some(snapshot) = snapshot {
        return build_feishu_interactive_card(
            snapshot,
            "Fund Helper·连通性测试",
            "连通性测试 · 收到此卡片表示配置正确",
        );
    }

    json!({
        "config": { "wide_screen_mode": true },
        "header": {
            "title": { "tag": "plain_text", "content": "📊 Fund Helper·连通性测试" },
            "subtitle": { "tag": "plain_text", "content": "收到本卡片表示飞书配置正确" },
            "template": "blue"
        },
        "elements": [
            {
                "tag": "div",
                "fields": [
                    feishu_field("✅ 连接状态", "<font color='green'>正常</font>"),
                    feishu_field("🚀 数据同步", "待命中"),
                ]
            },
            {
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": "👋 **你好！** 这是一条连通性测试消息。\n\n当前未能拉取持仓数据；正式推送时涨用 <font color='red'>↑</font>、跌用 <font color='green'>↓</font> 标识。"
                }
            },
            {
                "tag": "note",
                "elements": [{ "tag": "plain_text", "content": NOTIFY_FOOTER }]
            }
        ]
    })
}

pub fn build_feishu_interactive_card(
    snapshot: &PortfolioSnapshot,
    title: &str,
    subtitle: &str,
) -> Value {
    let trading_label = if snapshot.trading {
        "交易时段"
    } else {
        "非交易时段"
    };
    let trading_icon = if snapshot.trading { "🟢" } else { "🌙" };
    let updated_at = snapshot.updated_at.replace('T', " ");
    let header_template = feishu_header_template(snapshot.today_income);
    let card_subtitle = if subtitle.is_empty() {
        feishu_mood_text(snapshot.today_income, snapshot.today_income_rate, true)
    } else {
        subtitle.to_string()
    };

    let mut elements = vec![
        json!({
            "tag": "div",
            "text": {
                "tag": "lark_md",
                "content": format!("🕐 **{updated_at}** · {trading_icon} {trading_label}")
            }
        }),
        json!({ "tag": "hr" }),
        json!({
            "tag": "div",
            "fields": [
                feishu_field("💰 总资产", &format_money(snapshot.total_assets)),
                feishu_field(
                    &format!("{} 当日收益", trend_emoji(snapshot.today_income, false)),
                    &feishu_colored_amount(snapshot.today_income),
                ),
                feishu_field(
                    &format!("{} 收益率", trend_emoji(snapshot.today_income_rate, false)),
                    &feishu_colored_rate(snapshot.today_income_rate),
                ),
                feishu_field(
                    "涨跌分布",
                    &rise_fall_summary(snapshot.rise_count, snapshot.fall_count),
                ),
            ]
        }),
    ];

    if !snapshot.accounts.is_empty() {
        elements.push(json!({ "tag": "hr" }));
        elements.push(json!({
            "tag": "div",
            "text": { "tag": "lark_md", "content": "**📂 分组收益**" }
        }));
        for account in &snapshot.accounts {
            elements.push(json!({
                "tag": "div",
                "text": { "tag": "lark_md", "content": build_account_content(account) }
            }));
        }
    }

    elements.push(json!({ "tag": "hr" }));
    elements.push(json!({
        "tag": "note",
        "elements": [{
            "tag": "plain_text",
            "content": format!("✨ {NOTIFY_FOOTER}")
        }]
    }));

    json!({
        "config": { "wide_screen_mode": true },
        "header": {
            "title": {
                "tag": "plain_text",
                "content": if title.starts_with('📊') { title.to_string() } else { format!("📊 {title}") }
            },
            "subtitle": { "tag": "plain_text", "content": card_subtitle },
            "template": header_template
        },
        "elements": elements
    })
}

fn build_account_content(account: &AccountItem) -> String {
    let mut content = format!(
        "{} **{}**  \n当日 {}（{}）",
        trend_emoji(account.today_income, false),
        account.title,
        feishu_colored_amount(account.today_income),
        feishu_colored_rate(account.today_income_rate),
    );
    let fund_lines: Vec<String> = sort_funds_by_day_earn(&account.funds)
        .iter()
        .map(|fund| format_fund_line(fund))
        .collect();
    if !fund_lines.is_empty() {
        content.push('\n');
        content.push_str(&fund_lines.join("\n"));
    }
    content
}

fn format_fund_line(fund: &FundItem) -> String {
    let name = if fund.short_name.is_empty() {
        fund.code.clone()
    } else {
        fund.short_name.clone()
    };
    let label = if fund.code.is_empty() {
        name
    } else {
        format!("{name}({})", fund.code)
    };
    format!(
        "{emoji} {label}  {amount}  {rate}",
        emoji = trend_emoji_bold(fund.day_earn),
        amount = feishu_colored_amount(fund.day_earn),
        rate = feishu_colored_rate(fund.day_rate),
    )
}

fn sort_funds_by_day_earn(funds: &[FundItem]) -> Vec<&FundItem> {
    let mut sorted: Vec<&FundItem> = funds.iter().collect();
    sorted.sort_by(|a, b| {
        let key = |f: &FundItem| {
            if f.day_earn > 0.0 {
                (0, -f.day_earn)
            } else if f.day_earn < 0.0 {
                (2, f.day_earn)
            } else {
                (1, 0.0)
            }
        };
        key(a)
            .0
            .cmp(&key(b).0)
            .then_with(|| key(a).1.partial_cmp(&key(b).1).unwrap_or(std::cmp::Ordering::Equal))
    });
    sorted
}

fn feishu_field(label: &str, value_md: &str) -> Value {
    json!({
        "is_short": true,
        "text": { "tag": "lark_md", "content": format!("**{label}**\n{value_md}") }
    })
}

fn income_color(value: f64) -> &'static str {
    if value > 0.0 {
        "red"
    } else if value < 0.0 {
        "green"
    } else {
        "grey"
    }
}

fn trend_emoji(value: f64, markdown: bool) -> String {
    if value > 0.0 {
        if markdown {
            "<font color='red'>↑</font>".to_string()
        } else {
            "↑".to_string()
        }
    } else if value < 0.0 {
        if markdown {
            "<font color='green'>↓</font>".to_string()
        } else {
            "↓".to_string()
        }
    } else if markdown {
        "→".to_string()
    } else {
        "-".to_string()
    }
}

fn trend_emoji_bold(value: f64) -> &'static str {
    if value > 0.0 {
        "<font color='red'>▲</font>"
    } else if value < 0.0 {
        "<font color='green'>▼</font>"
    } else {
        "▫️"
    }
}

fn rise_fall_summary(rise: i64, fall: i64) -> String {
    format!(
        "<font color='red'>↑</font> {rise} · <font color='green'>↓</font> {fall}"
    )
}

fn feishu_header_template(income: f64) -> &'static str {
    if income > 0.0 {
        "red"
    } else if income < 0.0 {
        "green"
    } else {
        "blue"
    }
}

fn feishu_mood_text(income: f64, rate: f64, plain: bool) -> String {
    let icon = trend_emoji(income, !plain);
    format!(
        "{icon} 当日 {} · {}",
        format_signed_amount(income),
        format_percent(rate)
    )
}

fn feishu_colored_amount(value: f64) -> String {
    format!(
        "<font color='{}'>{}</font>",
        income_color(value),
        format_signed_amount(value)
    )
}

fn feishu_colored_rate(value: f64) -> String {
    format!(
        "<font color='{}'>{}</font>",
        income_color(value),
        format_percent(value)
    )
}

fn format_signed_amount(value: f64) -> String {
    let rounded = (value * 100.0).round() / 100.0;
    if rounded > 0.0 {
        format!("+{rounded:.2}")
    } else {
        format!("{rounded:.2}")
    }
}

fn format_percent(value: f64) -> String {
    let rounded = (value * 100.0).round() / 100.0;
    if rounded > 0.0 {
        format!("+{rounded:.2}%")
    } else {
        format!("{rounded:.2}%")
    }
}

fn format_money(value: f64) -> String {
    format!("{value:.2}")
}

pub fn feishu_webhook_payload(card: &Value) -> Value {
    json!({ "msg_type": "interactive", "card": card })
}

pub fn feishu_im_payload(card: &Value) -> Value {
    json!({
        "msg_type": "interactive",
        "content": serde_json::to_string(card).unwrap_or_else(|_| "{}".to_string())
    })
}
