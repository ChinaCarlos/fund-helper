from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from app.auth.models import User
from app.market.fund_rank import get_fund_rank
from app.market.heatmap import get_heatmap
from app.notify.content_types import (
    CONTENT_TYPE_LABELS,
    NotifyContentType,
    normalize_content_types,
)
from app.notify.template import (
    build_feishu_fund_rank_card,
    build_feishu_interactive_card,
    build_feishu_sector_flow_card,
    build_feishu_sector_change_card,
    build_portfolio_notification,
)
from app.services.poller import PortfolioPoller


@dataclass
class NotificationSection:
    content_type: NotifyContentType
    title: str
    text: str
    feishu_card: dict[str, Any]


def _item_dict(item: Any) -> dict[str, Any]:
    if hasattr(item, "model_dump"):
        return item.model_dump()
    if isinstance(item, dict):
        return item
    return {}


def _top_items(items: list[Any], *, limit: int) -> list[dict[str, Any]]:
    return [_item_dict(item) for item in items[:limit]]


async def _fetch_fund_rank_section(
    content_type: NotifyContentType,
    *,
    dimension: str,
    order: str,
    sign_filter: str,
    title: str,
    header_template: str,
) -> NotificationSection:
    result = await get_fund_rank(
        dimension=dimension,  # type: ignore[arg-type]
        scope="open",
        page=1,
        page_size=20,
        order=order,
        sign_filter=sign_filter,  # type: ignore[arg-type]
    )
    items = _top_items(result.items, limit=20)
    rate_key = "estimate_rate" if dimension == "estimate_rate" else "day"
    card = build_feishu_fund_rank_card(
        items,
        title=title,
        subtitle=f"{result.updated_at} · {'交易时段' if result.trading else '非交易时段'}",
        rate_key=rate_key,
        header_template=header_template,
    )
    text_lines = [f"【{title}】", result.updated_at, ""]
    for item in items:
        rate = item.get(rate_key)
        rate_text = f"{rate:.2f}%" if isinstance(rate, (int, float)) else "—"
        text_lines.append(f"{item.get('rank', '—')}. {item.get('name')}({item.get('code')}) {rate_text}")
    return NotificationSection(
        content_type=content_type,
        title=title,
        text="\n".join(text_lines),
        feishu_card=card,
    )


async def _fetch_sector_change_section() -> NotificationSection:
    industry, concept = await asyncio.gather(
        get_heatmap(kind="sector_change", board_type="industry"),
        get_heatmap(kind="sector_change", board_type="concept"),
    )

    def split_top10(items: list[Any]) -> tuple[list[dict], list[dict]]:
        rows = [_item_dict(item) for item in items]
        gain_rows = [row for row in rows if (row.get("change_rate") or 0) > 0]
        loss_rows = [row for row in rows if (row.get("change_rate") or 0) < 0]
        gain = sorted(gain_rows, key=lambda row: row["change_rate"], reverse=True)[:10]
        loss = sorted(loss_rows, key=lambda row: row["change_rate"])[:10]
        return gain, loss

    ind_gain, ind_loss = split_top10(industry.items)
    con_gain, con_loss = split_top10(concept.items)
    title = CONTENT_TYPE_LABELS["sector_change_top10"]
    updated_at = industry.updated_at
    trading = industry.trading

    card = build_feishu_sector_change_card(
        industry_gain=ind_gain,
        industry_loss=ind_loss,
        concept_gain=con_gain,
        concept_loss=con_loss,
        updated_at=updated_at,
        trading=trading,
    )
    text = build_sector_change_text(
        industry_gain=ind_gain,
        industry_loss=ind_loss,
        concept_gain=con_gain,
        concept_loss=con_loss,
        updated_at=updated_at,
    )
    return NotificationSection(
        content_type="sector_change_top10",
        title=title,
        text=text,
        feishu_card=card,
    )


async def _fetch_sector_flow_section() -> NotificationSection:
    industry, concept = await asyncio.gather(
        get_heatmap(kind="fund_flow", board_type="industry", indicator="今日"),
        get_heatmap(kind="fund_flow", board_type="concept", indicator="今日"),
    )

    def split_flow(items: list[Any]) -> tuple[list[dict], list[dict]]:
        rows = [_item_dict(item) for item in items]
        inflow_rows = [row for row in rows if (row.get("net_flow") or 0) > 0]
        outflow_rows = [row for row in rows if (row.get("net_flow") or 0) < 0]
        inflow = sorted(inflow_rows, key=lambda row: row["net_flow"], reverse=True)[:10]
        outflow = sorted(outflow_rows, key=lambda row: row["net_flow"])[:10]
        return inflow, outflow

    ind_in, ind_out = split_flow(industry.items)
    con_in, con_out = split_flow(concept.items)
    title = CONTENT_TYPE_LABELS["sector_flow_top10"]

    card = build_feishu_sector_flow_card(
        industry_inflow=ind_in,
        industry_outflow=ind_out,
        concept_inflow=con_in,
        concept_outflow=con_out,
        updated_at=industry.updated_at,
        trading=industry.trading,
    )
    text = build_sector_flow_text(
        industry_inflow=ind_in,
        industry_outflow=ind_out,
        concept_inflow=con_in,
        concept_outflow=con_out,
        updated_at=industry.updated_at,
    )
    return NotificationSection(
        content_type="sector_flow_top10",
        title=title,
        text=text,
        feishu_card=card,
    )


def build_sector_change_text(
    *,
    industry_gain: list[dict],
    industry_loss: list[dict],
    concept_gain: list[dict],
    concept_loss: list[dict],
    updated_at: str,
) -> str:
    lines = [f"【{CONTENT_TYPE_LABELS['sector_change_top10']}】", updated_at, ""]

    def append_block(label: str, gain: list[dict], loss: list[dict]) -> None:
        lines.append(f"▎{label}")
        lines.append("  涨幅 Top10")
        for index, item in enumerate(gain, start=1):
            rate = item.get("change_rate")
            rate_text = f"{rate:.2f}%" if isinstance(rate, (int, float)) else "—"
            lines.append(f"  {index}. {item.get('name')} {rate_text}")
        lines.append("  跌幅 Top10")
        for index, item in enumerate(loss, start=1):
            rate = item.get("change_rate")
            rate_text = f"{rate:.2f}%" if isinstance(rate, (int, float)) else "—"
            lines.append(f"  {index}. {item.get('name')} {rate_text}")
        lines.append("")

    append_block("行业板块", industry_gain, industry_loss)
    append_block("概念板块", concept_gain, concept_loss)
    return "\n".join(lines).strip()


def build_sector_flow_text(
    *,
    industry_inflow: list[dict],
    industry_outflow: list[dict],
    concept_inflow: list[dict],
    concept_outflow: list[dict],
    updated_at: str,
) -> str:
    lines = [f"【{CONTENT_TYPE_LABELS['sector_flow_top10']}】", updated_at, ""]

    def flow_line(index: int, item: dict) -> str:
        flow = item.get("net_flow")
        flow_text = f"{flow:+.2f}亿" if isinstance(flow, (int, float)) else "—"
        return f"  {index}. {item.get('name')} {flow_text}"

    def append_block(label: str, inflow: list[dict], outflow: list[dict]) -> None:
        lines.append(f"▎{label}")
        lines.append("  净流入 Top10")
        for index, item in enumerate(inflow, start=1):
            lines.append(flow_line(index, item))
        lines.append("  净流出 Top10")
        for index, item in enumerate(outflow, start=1):
            lines.append(flow_line(index, item))
        lines.append("")

    append_block("行业板块", industry_inflow, industry_outflow)
    append_block("概念板块", concept_inflow, concept_outflow)
    return "\n".join(lines).strip()


async def gather_notification_sections(
    content_types: list[str],
    *,
    user: User,
    poller: PortfolioPoller,
) -> list[NotificationSection]:
    selected = normalize_content_types(content_types)
    sections: list[NotificationSection] = []

    rank_tasks: dict[NotifyContentType, asyncio.Task[NotificationSection]] = {}
    if "fund_gain_top20" in selected:
        rank_tasks["fund_gain_top20"] = asyncio.create_task(
            _fetch_fund_rank_section(
                "fund_gain_top20",
                dimension="day",
                order="desc",
                sign_filter="positive",
                title=CONTENT_TYPE_LABELS["fund_gain_top20"],
                header_template="red",
            )
        )
    if "fund_loss_top20" in selected:
        rank_tasks["fund_loss_top20"] = asyncio.create_task(
            _fetch_fund_rank_section(
                "fund_loss_top20",
                dimension="day",
                order="asc",
                sign_filter="negative",
                title=CONTENT_TYPE_LABELS["fund_loss_top20"],
                header_template="green",
            )
        )
    if "fund_est_gain_top20" in selected:
        rank_tasks["fund_est_gain_top20"] = asyncio.create_task(
            _fetch_fund_rank_section(
                "fund_est_gain_top20",
                dimension="estimate_rate",
                order="desc",
                sign_filter="positive",
                title=CONTENT_TYPE_LABELS["fund_est_gain_top20"],
                header_template="red",
            )
        )
    if "fund_est_loss_top20" in selected:
        rank_tasks["fund_est_loss_top20"] = asyncio.create_task(
            _fetch_fund_rank_section(
                "fund_est_loss_top20",
                dimension="estimate_rate",
                order="asc",
                sign_filter="negative",
                title=CONTENT_TYPE_LABELS["fund_est_loss_top20"],
                header_template="green",
            )
        )

    sector_change_task: asyncio.Task[NotificationSection] | None = None
    sector_flow_task: asyncio.Task[NotificationSection] | None = None
    if "sector_change_top10" in selected:
        sector_change_task = asyncio.create_task(_fetch_sector_change_section())
    if "sector_flow_top10" in selected:
        sector_flow_task = asyncio.create_task(_fetch_sector_flow_section())

    if "portfolio" in selected and user.has_yjb:
        try:
            snapshot = await poller.fetch_snapshot(user)
            title = CONTENT_TYPE_LABELS["portfolio"]
            sections.append(
                NotificationSection(
                    content_type="portfolio",
                    title=title,
                    text=build_portfolio_notification(snapshot, title=f"Fund Helper·{title}"),
                    feishu_card=build_feishu_interactive_card(
                        snapshot,
                        title=f"Fund Helper·{title}",
                    ),
                )
            )
        except Exception:
            pass

    for content_type in selected:
        if content_type in rank_tasks:
            try:
                sections.append(await rank_tasks[content_type])
            except Exception:
                continue
        elif content_type == "sector_change_top10" and sector_change_task is not None:
            try:
                sections.append(await sector_change_task)
            except Exception:
                continue
        elif content_type == "sector_flow_top10" and sector_flow_task is not None:
            try:
                sections.append(await sector_flow_task)
            except Exception:
                continue

    return sections
