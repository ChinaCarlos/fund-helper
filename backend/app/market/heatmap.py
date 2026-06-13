from __future__ import annotations

import asyncio
import math
import time
from datetime import datetime
from typing import Any

import akshare as ak
import pandas as pd

from app.market.em_fetch import fetch_concept_board_df, fetch_industry_board_df

from app.market.schemas import (
    FundFlowIndicator,
    HeatmapBoardType,
    HeatmapItem,
    HeatmapKind,
    HeatmapOptionsResponse,
    HeatmapResponse,
)
from app.services.poller import is_trading_hours

CACHE_TTL_SECONDS = 90

FLOW_INDICATOR_THS_MAP: dict[FundFlowIndicator, str] = {
    "今日": "即时",
    "5日": "5日排行",
    "10日": "10日排行",
}


class _TimedCache:
    def __init__(self, ttl: int = CACHE_TTL_SECONDS):
        self.ttl = ttl
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if time.time() > expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (time.time() + self.ttl, value)


_cache = _TimedCache()


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except TypeError:
        pass
    return str(value).strip()


def _pick_column(columns: list[Any], marker: str) -> str | None:
    for col in columns:
        text = str(col)
        if marker in text:
            return text
    return None


def _flow_column_names(indicator: FundFlowIndicator) -> dict[str, str]:
    return {
        "change": f"{indicator}涨跌幅",
        "net_flow": f"{indicator}主力净流入-净额",
        "net_ratio": f"{indicator}主力净流入-净占比",
    }


def _load_sector_change_ths(board_type: HeatmapBoardType) -> list[HeatmapItem]:
    fetch = ak.stock_fund_flow_concept if board_type == "concept" else ak.stock_fund_flow_industry
    df = fetch("即时")
    items: list[HeatmapItem] = []
    for _, row in df.iterrows():
        name = _safe_str(row.get("行业"))
        if not name:
            continue
        items.append(
            HeatmapItem(
                name=name,
                change_rate=_safe_float(row.get("行业-涨跌幅")),
                leading_stock=_safe_str(row.get("领涨股")),
                leading_stock_change=_safe_float(row.get("领涨股-涨跌幅")),
            )
        )
    return items


def _load_fund_flow_ths(
    board_type: HeatmapBoardType,
    indicator: FundFlowIndicator,
) -> list[HeatmapItem]:
    ths_indicator = FLOW_INDICATOR_THS_MAP[indicator]
    fetch = ak.stock_fund_flow_concept if board_type == "concept" else ak.stock_fund_flow_industry
    df = fetch(ths_indicator)
    items: list[HeatmapItem] = []
    for _, row in df.iterrows():
        name = _safe_str(row.get("行业"))
        if not name:
            continue
        net_flow = _safe_float(row.get("净额"))
        items.append(
            HeatmapItem(
                name=name,
                change_rate=_safe_float(row.get("行业-涨跌幅")),
                net_flow=net_flow,
                leading_stock=_safe_str(row.get("领涨股")),
                leading_stock_change=_safe_float(row.get("领涨股-涨跌幅")),
            )
        )
    return items


def _load_sector_change_sync(board_type: HeatmapBoardType) -> list[HeatmapItem]:
    cache_key = f"sector_change:{board_type}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        if board_type == "concept":
            df = fetch_concept_board_df()
        else:
            df = fetch_industry_board_df()

        items: list[HeatmapItem] = []
        for _, row in df.iterrows():
            name = _safe_str(row.get("板块名称"))
            if not name:
                continue
            leading_change_col = _pick_column(list(df.columns), "领涨股票-涨跌幅")
            items.append(
                HeatmapItem(
                    name=name,
                    code=_safe_str(row.get("板块代码")),
                    change_rate=_safe_float(row.get("涨跌幅")),
                    leading_stock=_safe_str(row.get("领涨股票")),
                    leading_stock_change=_safe_float(row.get(leading_change_col)) if leading_change_col else None,
                    up_count=int(_safe_float(row.get("上涨家数")) or 0) or None,
                    down_count=int(_safe_float(row.get("下跌家数")) or 0) or None,
                )
            )
    except Exception:
        items = _load_sector_change_ths(board_type)

    _cache.set(cache_key, items)
    return items


def _load_fund_flow_sync(
    board_type: HeatmapBoardType,
    indicator: FundFlowIndicator,
) -> list[HeatmapItem]:
    cache_key = f"fund_flow:{board_type}:{indicator}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        sector_type = "概念资金流" if board_type == "concept" else "行业资金流"
        df = ak.stock_sector_fund_flow_rank(indicator=indicator, sector_type=sector_type)
        cols = _flow_column_names(indicator)
        change_col = _pick_column(list(df.columns), cols["change"]) or cols["change"]
        flow_col = _pick_column(list(df.columns), cols["net_flow"]) or cols["net_flow"]
        ratio_col = _pick_column(list(df.columns), cols["net_ratio"]) or cols["net_ratio"]

        items: list[HeatmapItem] = []
        for _, row in df.iterrows():
            name = _safe_str(row.get("名称"))
            if not name:
                continue
            net_flow = _safe_float(row.get(flow_col))
            items.append(
                HeatmapItem(
                    name=name,
                    code=_safe_str(row.get("代码")) if "代码" in df.columns else "",
                    change_rate=_safe_float(row.get(change_col)),
                    net_flow=round(net_flow / 1e8, 2) if net_flow is not None else None,
                    net_flow_ratio=_safe_float(row.get(ratio_col)),
                    leading_stock=_safe_str(row.get(f"{indicator}主力净流入最大股")),
                )
            )
    except Exception:
        items = _load_fund_flow_ths(board_type, indicator)

    _cache.set(cache_key, items)
    return items


async def get_heatmap(
    *,
    kind: HeatmapKind,
    board_type: HeatmapBoardType = "industry",
    indicator: FundFlowIndicator = "今日",
) -> HeatmapResponse:
    if kind == "sector_change":
        items = await asyncio.to_thread(_load_sector_change_sync, board_type)
        active_indicator = ""
    else:
        items = await asyncio.to_thread(_load_fund_flow_sync, board_type, indicator)
        active_indicator = indicator

    return HeatmapResponse(
        kind=kind,
        board_type=board_type,
        indicator=active_indicator,
        trading=is_trading_hours(),
        updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        items=items,
    )


async def get_heatmap_options() -> HeatmapOptionsResponse:
    return HeatmapOptionsResponse(
        kinds=[
            {"value": "sector_change", "label": "板块涨幅"},
            {"value": "fund_flow", "label": "资金流向"},
        ],
        board_types=[
            {"value": "industry", "label": "行业板块"},
            {"value": "concept", "label": "概念板块"},
        ],
        flow_indicators=["今日", "5日", "10日"],
        sources=[
            {
                "api": "stock_board_industry_name_em / stock_board_concept_name_em",
                "label": "东财板块涨跌",
            },
            {
                "api": "stock_sector_fund_flow_rank",
                "label": "东财板块主力资金流",
            },
        ],
    )
