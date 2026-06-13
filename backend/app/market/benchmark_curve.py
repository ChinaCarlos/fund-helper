from __future__ import annotations

import asyncio
import math
import time
from datetime import date, datetime, timedelta
from typing import Any

import akshare as ak
import pandas as pd

from app.market.schemas import CurveOverlayPoint, CurveOverlaySeries, CurveOverlaysResponse, FundCurvePeriod

CACHE_TTL_SECONDS = 3600

INDEX_SYMBOLS: dict[str, tuple[str, str]] = {
    "sh_index": ("sh000001", "上证指数"),
    "cyb_index": ("sz399006", "创业板指"),
}

PERIOD_DAYS: dict[FundCurvePeriod, int] = {
    "1月": 31,
    "3月": 92,
    "6月": 183,
    "1年": 365,
    "3年": 365 * 3,
    "5年": 365 * 5,
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


def _format_date(value: Any) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.isoformat()
    return str(value).strip()[:10]


def _period_to_date_range(period: FundCurvePeriod) -> tuple[str, str]:
    end = date.today()
    end_str = end.strftime("%Y%m%d")
    if period == "今年来":
        start = date(end.year, 1, 1)
    elif period == "成立来":
        return "19700101", end_str
    days = PERIOD_DAYS.get(period, 365)
    start = end - timedelta(days=days)
    return start.strftime("%Y%m%d"), end_str


def _compute_cumulative_returns(closes: list[float | None]) -> list[float | None]:
    first: float | None = None
    for value in closes:
        if value is not None and value != 0:
            first = value
            break
    if first is None:
        return [None] * len(closes)
    return [
        round((value / first - 1) * 100, 4) if value is not None else None
        for value in closes
    ]


def _filter_by_period(
    rows: list[tuple[str, float | None]],
    period: FundCurvePeriod,
) -> list[tuple[str, float | None]]:
    if period == "成立来" or not rows:
        return rows
    if period == "今年来":
        year_prefix = str(date.today().year)
        return [(d, v) for d, v in rows if d.startswith(year_prefix)]
    days = PERIOD_DAYS.get(period, 365)
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    return [(d, v) for d, v in rows if d >= cutoff]


def _rows_to_series(
    rows: list[tuple[str, float | None]],
    *,
    key: str,
    label: str,
) -> CurveOverlaySeries | None:
    if not rows:
        return None
    dates = [item[0] for item in rows]
    closes = [item[1] for item in rows]
    values = _compute_cumulative_returns(closes)
    points = [
        CurveOverlayPoint(date=date_text, value=value)
        for date_text, value in zip(dates, values, strict=False)
        if value is not None
    ]
    if not points:
        return None
    return CurveOverlaySeries(key=key, label=label, points=points)


def _load_board_curve_sync(
    sector_name: str,
    board_type: str,
    period: FundCurvePeriod,
) -> CurveOverlaySeries | None:
    cache_key = f"board_curve:{board_type}:{sector_name}:{period}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    start_date, end_date = _period_to_date_range(period)
    fetch = (
        ak.stock_board_concept_hist_em
        if board_type == "concept"
        else ak.stock_board_industry_hist_em
    )
    df = fetch(
        symbol=sector_name,
        period="日k",
        start_date=start_date,
        end_date=end_date,
        adjust="",
    )

    rows: list[tuple[str, float | None]] = []
    for _, row in df.iterrows():
        date_text = _format_date(row.get("日期"))
        if not date_text:
            continue
        rows.append((date_text, _safe_float(row.get("收盘"))))

    series = _rows_to_series(rows, key="sector", label=f"{sector_name}")
    if series is not None:
        _cache.set(cache_key, series)
    return series


def _load_index_curve_sync(symbol: str, period: FundCurvePeriod) -> list[tuple[str, float | None]]:
    cache_key = f"index_curve:{symbol}:{period}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    df = ak.stock_zh_index_daily_em(symbol=symbol)
    rows: list[tuple[str, float | None]] = []
    for _, row in df.iterrows():
        date_text = _format_date(row.get("date"))
        if not date_text:
            continue
        rows.append((date_text, _safe_float(row.get("close"))))

    rows = _filter_by_period(rows, period)
    _cache.set(cache_key, rows)
    return rows


async def get_curve_overlays(
    *,
    period: FundCurvePeriod = "1年",
    sector_name: str = "",
    board_type: str = "industry",
) -> CurveOverlaysResponse:
    series: list[CurveOverlaySeries] = []

    if sector_name.strip():
        board_series = await asyncio.to_thread(
            _load_board_curve_sync,
            sector_name.strip(),
            board_type,
            period,
        )
        if board_series is not None:
            series.append(board_series)

    for key, (symbol, label) in INDEX_SYMBOLS.items():
        try:
            rows = await asyncio.to_thread(_load_index_curve_sync, symbol, period)
            index_series = _rows_to_series(rows, key=key, label=label)
            if index_series is not None:
                series.append(index_series)
        except Exception:
            continue

    return CurveOverlaysResponse(
        period=period,
        sector_name=sector_name.strip(),
        board_type=board_type,
        series=series,
        updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )
