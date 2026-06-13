from __future__ import annotations

import json
from datetime import datetime
from typing import Any

# 企业微信单条文本建议控制在 2KB 内
DEFAULT_MAX_LENGTH = 1800


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def format_signed_amount(value: float, digits: int = 2) -> str:
    rounded = round(value, digits)
    if rounded > 0:
        return f"+{rounded:,.{digits}f}"
    if rounded < 0:
        return f"{rounded:,.{digits}f}"
    return f"{rounded:,.{digits}f}"


def format_percent(value: float, digits: int = 2) -> str:
    rounded = round(value, digits)
    if rounded > 0:
        return f"+{rounded:.{digits}f}%"
    if rounded < 0:
        return f"{rounded:.{digits}f}%"
    return f"{rounded:.{digits}f}%"


def format_money(value: float, digits: int = 2) -> str:
    return f"{_to_float(value):,.{digits}f}"


def _income_color(value: float) -> str:
    if value > 0:
        return "red"
    if value < 0:
        return "green"
    return "grey"


def _trend_emoji(value: float, *, markdown: bool = True) -> str:
    if value > 0:
        return "<font color='red'>↑</font>" if markdown else "↑"
    if value < 0:
        return "<font color='green'>↓</font>" if markdown else "↓"
    return "→" if markdown else "-"


def _trend_emoji_bold(value: float) -> str:
    if value > 0:
        return "<font color='red'>▲</font>"
    if value < 0:
        return "<font color='green'>▼</font>"
    return "▫️"


def _rise_fall_summary(rise: int, fall: int, *, markdown: bool = True) -> str:
    if markdown:
        return (
            f"<font color='red'>↑</font> {rise} · "
            f"<font color='green'>↓</font> {fall}"
        )
    return f"↑ {rise} · ↓ {fall}"


def _feishu_header_template(income: float) -> str:
    if income > 0:
        return "red"
    if income < 0:
        return "green"
    return "blue"


def _feishu_mood_text(income: float, rate: float, *, plain: bool = False) -> str:
    icon = _trend_emoji(income, markdown=not plain)
    return f"{icon} 当日 {format_signed_amount(income)} · {format_percent(rate)}"


def _feishu_colored_amount(value: float) -> str:
    return (
        f"<font color='{_income_color(value)}'>{format_signed_amount(value)}</font>"
    )


def _feishu_colored_rate(value: float) -> str:
    return f"<font color='{_income_color(value)}'>{format_percent(value)}</font>"


def _feishu_field(label: str, value_md: str, *, short: bool = True) -> dict[str, Any]:
    return {
        "is_short": short,
        "text": {
            "tag": "lark_md",
            "content": f"**{label}**\n{value_md}",
        },
    }


def _format_updated_at(snapshot: dict) -> str:
    raw = snapshot.get("updated_at")
    if isinstance(raw, str) and raw:
        return raw.replace("T", " ")
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _format_trading_label(snapshot: dict) -> str:
    return "交易时段" if snapshot.get("trading") else "非交易时段"


def _fund_day_earn(fund: dict) -> float:
    return _to_float(fund.get("day_earn"))


def _sort_funds_by_day_earn(funds: list[dict]) -> list[dict]:
    """涨（红）在上按收益降序，持平居中，跌（绿）在下按亏损升序。"""

    def sort_key(fund: dict) -> tuple[int, float]:
        earn = _fund_day_earn(fund)
        if earn > 0:
            return (0, -earn)
        if earn < 0:
            return (2, earn)
        return (1, 0.0)

    return sorted(funds, key=sort_key)


def _format_fund_line(fund: dict) -> str:
    name = fund.get("short_name") or fund.get("code") or "未知基金"
    code = fund.get("code") or ""
    earn = _to_float(fund.get("day_earn"))
    rate = _to_float(fund.get("day_rate"))
    label = f"{name}({code})" if code else str(name)
    return (
        f"  {_trend_emoji(earn, markdown=False)} {label}  "
        f"{format_signed_amount(earn)}  {format_percent(rate)}"
    )


def build_portfolio_notification(
    snapshot: dict,
    *,
    title: str = "Fund Helper·持仓收益",
    prefix: str = "",
    max_length: int = DEFAULT_MAX_LENGTH,
) -> str:
    lines: list[str] = []

    if prefix:
        lines.append(prefix.rstrip())
        lines.append("")

    lines.append(f"【{title}】")
    lines.append(f"{_format_updated_at(snapshot)} · {_format_trading_label(snapshot)}")
    lines.append("")

    total_assets = _to_float(snapshot.get("total_assets"))
    today_income = _to_float(snapshot.get("today_income"))
    today_rate = _to_float(snapshot.get("today_income_rate"))
    rise = int(snapshot.get("rise_count") or 0)
    fall = int(snapshot.get("fall_count") or 0)

    lines.append("━━ 总览 ━━")
    lines.append(f"总资产：{format_money(total_assets)}")
    lines.append(
        f"当日总收益：{format_signed_amount(today_income)}（{format_percent(today_rate)}）"
    )
    lines.append(f"涨跌：{_rise_fall_summary(rise, fall, markdown=False)}")
    lines.append("")

    accounts = snapshot.get("accounts") or []
    if accounts:
        lines.append("━━ 分组收益 ━━")
        for account in accounts:
            title_text = account.get("title") or f"账户{account.get('account_id', '')}"
            acc_income = _to_float(account.get("today_income"))
            acc_rate = _to_float(account.get("today_income_rate"))
            lines.append(f"▎{title_text}")
            lines.append(
                f"  当日收益：{format_signed_amount(acc_income)}（{format_percent(acc_rate)}）"
            )
            funds = _sort_funds_by_day_earn(account.get("funds") or [])
            for fund in funds:
                lines.append(_format_fund_line(fund))
            lines.append("")

    lines.append("——")
    lines.append("Fund Helper")

    text = "\n".join(lines).strip()
    if len(text) <= max_length:
        return text

    truncated = text[: max_length - 20].rstrip()
    return f"{truncated}\n…（内容过长已截断）"


def build_feishu_interactive_card(
    snapshot: dict,
    *,
    title: str = "Fund Helper·持仓收益",
    subtitle: str = "",
) -> dict[str, Any]:
    """飞书消息卡片（群机器人 Webhook / 应用 IM 通用结构）。"""
    today_income = _to_float(snapshot.get("today_income"))
    today_rate = _to_float(snapshot.get("today_income_rate"))
    total_assets = _to_float(snapshot.get("total_assets"))
    rise = int(snapshot.get("rise_count") or 0)
    fall = int(snapshot.get("fall_count") or 0)
    trading_label = _format_trading_label(snapshot)
    updated_at = _format_updated_at(snapshot)
    trading_icon = "🟢" if snapshot.get("trading") else "🌙"

    elements: list[dict[str, Any]] = [
        {
            "tag": "div",
            "text": {
                "tag": "lark_md",
                "content": f"🕐 **{updated_at}** · {trading_icon} {trading_label}",
            },
        },
        {"tag": "hr"},
        {
            "tag": "div",
            "fields": [
                _feishu_field("💰 总资产", format_money(total_assets)),
                _feishu_field(
                    f"{_trend_emoji(today_income, markdown=False)} 当日收益",
                    _feishu_colored_amount(today_income),
                ),
                _feishu_field(
                    f"{_trend_emoji(today_rate, markdown=False)} 收益率",
                    _feishu_colored_rate(today_rate),
                ),
                _feishu_field("涨跌分布", _rise_fall_summary(rise, fall)),
            ],
        },
    ]

    accounts = snapshot.get("accounts") or []
    if accounts:
        elements.append({"tag": "hr"})
        elements.append(
            {
                "tag": "div",
                "text": {"tag": "lark_md", "content": "**📂 分组收益**"},
            }
        )
        for account in accounts:
            acc_title = account.get("title") or f"账户{account.get('account_id', '')}"
            acc_income = _to_float(account.get("today_income"))
            acc_rate = _to_float(account.get("today_income_rate"))
            fund_lines: list[str] = []
            funds = _sort_funds_by_day_earn(account.get("funds") or [])
            for fund in funds:
                name = fund.get("short_name") or fund.get("code") or "未知"
                code = fund.get("code") or ""
                earn = _to_float(fund.get("day_earn"))
                rate = _to_float(fund.get("day_rate"))
                label = f"{name}({code})" if code else name
                fund_lines.append(
                    f"{_trend_emoji_bold(earn)} {label}  "
                    f"{_feishu_colored_amount(earn)}  {_feishu_colored_rate(rate)}"
                )

            content = (
                f"{_trend_emoji(acc_income, markdown=False)} **{acc_title}**  \n"
                f"当日 {_feishu_colored_amount(acc_income)}（{_feishu_colored_rate(acc_rate)}）"
            )
            if fund_lines:
                content += "\n" + "\n".join(fund_lines)

            elements.append(
                {
                    "tag": "div",
                    "text": {"tag": "lark_md", "content": content},
                }
            )

    elements.append({"tag": "hr"})
    elements.append(
        {
            "tag": "note",
            "elements": [
                {
                    "tag": "plain_text",
                    "content": subtitle or "✨ Fund Helper",
                }
            ],
        }
    )

    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {
                "tag": "plain_text",
                "content": title if title.startswith("📊") else f"📊 {title}",
            },
            "subtitle": {
                "tag": "plain_text",
                "content": subtitle or _feishu_mood_text(today_income, today_rate, plain=True),
            },
            "template": _feishu_header_template(today_income),
        },
        "elements": elements,
    }


def build_feishu_webhook_payload(card: dict[str, Any]) -> dict[str, Any]:
    return {"msg_type": "interactive", "card": card}


def build_feishu_im_payload(card: dict[str, Any]) -> dict[str, Any]:
    return {
        "msg_type": "interactive",
        "content": json.dumps(card, ensure_ascii=False),
    }


def build_connectivity_test_message(snapshot: dict | None) -> str:
    if snapshot:
        return build_portfolio_notification(
            snapshot,
            title="Fund Helper·连通性测试",
            prefix="[连通性测试] 以下为当前持仓收益快照：",
        )
    return (
        "【Fund Helper·连通性测试】\n"
        "你好，这是 fund-helper system message test\n"
        "（未能拉取持仓数据，仅发送占位文案）"
    )


def build_connectivity_test_card(snapshot: dict | None) -> dict[str, Any]:
    if snapshot:
        return build_feishu_interactive_card(
            snapshot,
            title="Fund Helper·连通性测试",
            subtitle="连通性测试 · 收到此卡片表示配置正确",
        )
    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": "📊 Fund Helper·连通性测试"},
            "subtitle": {
                "tag": "plain_text",
                "content": "收到本卡片表示飞书配置正确",
            },
            "template": "blue",
        },
        "elements": [
            {
                "tag": "div",
                "fields": [
                    _feishu_field("✅ 连接状态", "<font color='green'>正常</font>"),
                    _feishu_field("🚀 数据同步", "待命中"),
                ],
            },
            {
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": (
                        "👋 **你好！** 这是一条连通性测试消息。\n\n"
                        "当前未能拉取持仓数据；正式推送时涨用 <font color='red'>↑</font>、"
                        "跌用 <font color='green'>↓</font> 标识。"
                    ),
                },
            },
            {
                "tag": "note",
                "elements": [
                    {
                        "tag": "plain_text",
                        "content": "Fund Helper",
                    }
                ],
            },
        ],
    }
