use crate::portfolio::{FundItem, PortfolioSnapshot};

const MAX_LENGTH: usize = 1800;

pub const NOTIFY_FOOTER: &str = "Fund Helper · Desktop";

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

fn trend_emoji(value: f64) -> &'static str {
    if value > 0.0 {
        "↑"
    } else if value < 0.0 {
        "↓"
    } else {
        "→"
    }
}

fn rise_fall_summary(rise: i64, fall: i64) -> String {
    format!("↑ {rise} · ↓ {fall}")
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
        "  {} {label}  {}  {}",
        trend_emoji(fund.day_earn),
        format_signed_amount(fund.day_earn),
        format_percent(fund.day_rate)
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

pub fn build_portfolio_notification(snapshot: &PortfolioSnapshot) -> String {
    let trading_label = if snapshot.trading {
        "交易时段"
    } else {
        "非交易时段"
    };

    let mut lines = vec![
        "【Fund Helper·持仓收益】".to_string(),
        format!("{} · {trading_label}", snapshot.updated_at),
        String::new(),
        "━━ 总览 ━━".to_string(),
        format!("总资产：{}", format_money(snapshot.total_assets)),
        format!(
            "当日总收益：{}（{}）",
            format_signed_amount(snapshot.today_income),
            format_percent(snapshot.today_income_rate)
        ),
        format!(
            "涨跌：{}",
            rise_fall_summary(snapshot.rise_count, snapshot.fall_count)
        ),
        String::new(),
    ];

    if !snapshot.accounts.is_empty() {
        lines.push("━━ 分组收益 ━━".to_string());
        for account in &snapshot.accounts {
            lines.push(format!("▎{}", account.title));
            lines.push(format!(
                "  当日收益：{}（{}）",
                format_signed_amount(account.today_income),
                format_percent(account.today_income_rate)
            ));
            for fund in sort_funds_by_day_earn(&account.funds) {
                lines.push(format_fund_line(fund));
            }
            lines.push(String::new());
        }
    }

    lines.push("——".to_string());
    lines.push(NOTIFY_FOOTER.to_string());

    let mut text = lines.join("\n").trim().to_string();
    if text.len() > MAX_LENGTH {
        let truncated = text.chars().take(MAX_LENGTH - 20).collect::<String>();
        text = format!("{truncated}\n…（内容过长已截断）");
    }
    text
}

pub fn build_connectivity_test_message(snapshot: Option<&PortfolioSnapshot>) -> String {
    if let Some(s) = snapshot {
        let mut text = build_portfolio_notification(s);
        text = text.replace("【Fund Helper·持仓收益】", "【Fund Helper·连通性测试】");
        return text;
    }
    "【Fund Helper·连通性测试】\n你好，这是 fund-helper system message test\nFund Helper · Desktop".to_string()
}
