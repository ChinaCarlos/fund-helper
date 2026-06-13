from __future__ import annotations

import asyncio
import math
import time
from datetime import date, datetime, timedelta
from typing import Any, Literal

import akshare as ak
import pandas as pd

from app.market.schemas import (
    FundCurveIndicator,
    FundCurveKind,
    FundCurveOptionsResponse,
    FundCurvePeriod,
    FundCurvePoint,
    FundCurveResponse,
)

CACHE_TTL_SECONDS = 3600
CODE_SET_TTL_SECONDS = 3600

CURVE_INDICATORS: dict[FundCurveIndicator, str] = {
    "累计收益率走势": "累计收益率",
    "单位净值走势": "单位净值",
}

CURVE_PERIODS: list[FundCurvePeriod] = [
    "1月",
    "3月",
    "6月",
    "1年",
    "3年",
    "5年",
    "今年来",
    "成立来",
]

PERIOD_DAYS: dict[FundCurvePeriod, int] = {
    "1月": 31,
    "3月": 92,
    "6月": 183,
    "1年": 365,
    "3年": 365 * 3,
    "5年": 365 * 5,
}

KIND_SOURCE_API: dict[FundCurveKind, str] = {
    "open": "fund_open_fund_info_em",
    "etf": "fund_etf_hist_em",
    "lof": "fund_lof_hist_em",
}

KIND_INDICATOR_LABELS: dict[FundCurveKind, dict[FundCurveIndicator, str]] = {
    "open": {
        "累计收益率走势": "累计收益率",
        "单位净值走势": "单位净值",
    },
    "etf": {
        "累计收益率走势": "累计收益率（收盘价）",
        "单位净值走势": "收盘价",
    },
    "lof": {
        "累计收益率走势": "累计收益率（收盘价）",
        "单位净值走势": "收盘价",
    },
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

    def set(self, key: str, value: Any, *, ttl: int | None = None) -> None:
        self._store[key] = (time.time() + (ttl or self.ttl), value)


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


def _load_etf_codes_sync() -> set[str]:
    cached = _cache.get("etf_codes")
    if cached is not None:
        return set(cached)

    raw = ak.fund_etf_spot_em()
    codes = {_safe_str(row.get("代码")) for _, row in raw.iterrows()}
    codes.discard("")
    _cache.set("etf_codes", codes, ttl=CODE_SET_TTL_SECONDS)
    return codes


def _load_lof_codes_sync() -> set[str]:
    cached = _cache.get("lof_codes")
    if cached is not None:
        return set(cached)

    raw = ak.fund_lof_spot_em()
    codes = {_safe_str(row.get("代码")) for _, row in raw.iterrows()}
    codes.discard("")
    _cache.set("lof_codes", codes, ttl=CODE_SET_TTL_SECONDS)
    return codes


def _guess_fund_kind(code: str) -> FundCurveKind:
    if len(code) != 6 or not code.isdigit():
        return "open"
    if code.startswith(("5", "15")):
        return "etf"
    if code.startswith("16"):
        return "lof"
    return "open"


def _detect_fund_kind_sync(code: str) -> FundCurveKind:
    try:
        if code in _load_etf_codes_sync():
            return "etf"
    except Exception:
        pass

    try:
        if code in _load_lof_codes_sync():
            return "lof"
    except Exception:
        pass

    return _guess_fund_kind(code)


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


def _load_open_nav_maps(code: str) -> tuple[dict[str, float | None], dict[str, float | None]]:
    df_nav = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
    nav_map: dict[str, float | None] = {}
    change_map: dict[str, float | None] = {}
    for _, row in df_nav.iterrows():
        date_text = _format_date(row.get("净值日期"))
        if not date_text:
            continue
        nav_map[date_text] = _safe_float(row.get("单位净值"))
        change_col = "日增长率" if "日增长率" in df_nav.columns else None
        change_map[date_text] = _safe_float(row.get(change_col)) if change_col else None
    return nav_map, change_map


def _load_open_curve_sync(
    code: str,
    indicator: FundCurveIndicator,
    period: FundCurvePeriod,
) -> list[FundCurvePoint]:
    if indicator == "累计收益率走势":
        df = ak.fund_open_fund_info_em(symbol=code, indicator=indicator, period=period)
        nav_map, change_map = _load_open_nav_maps(code)
        points: list[FundCurvePoint] = []
        for _, row in df.iterrows():
            date_text = _format_date(row.get("日期"))
            if not date_text:
                continue
            points.append(
                FundCurvePoint(
                    date=date_text,
                    value=_safe_float(row.get("累计收益率")),
                    nav=nav_map.get(date_text),
                    change_rate=change_map.get(date_text),
                )
            )
        return points

    df = ak.fund_open_fund_info_em(symbol=code, indicator=indicator)
    value_col = CURVE_INDICATORS[indicator]
    date_col = "净值日期"
    change_col = "日增长率" if "日增长率" in df.columns else None

    points = []
    for _, row in df.iterrows():
        date_text = _format_date(row.get(date_col))
        if not date_text:
            continue
        nav = _safe_float(row.get(value_col))
        points.append(
            FundCurvePoint(
                date=date_text,
                value=nav,
                nav=nav,
                change_rate=_safe_float(row.get(change_col)) if change_col else None,
            )
        )
    return points


def _load_market_curve_sync(
    code: str,
    kind: Literal["etf", "lof"],
    indicator: FundCurveIndicator,
    period: FundCurvePeriod,
) -> list[FundCurvePoint]:
    active_period = period if indicator == "累计收益率走势" else "成立来"
    start_date, end_date = _period_to_date_range(active_period)
    fetch = ak.fund_etf_hist_em if kind == "etf" else ak.fund_lof_hist_em
    df = fetch(
        symbol=code,
        period="daily",
        start_date=start_date,
        end_date=end_date,
        adjust="",
    )

    rows: list[tuple[str, float | None, float | None]] = []
    for _, row in df.iterrows():
        date_text = _format_date(row.get("日期"))
        if not date_text:
            continue
        close = _safe_float(row.get("收盘"))
        change_rate = _safe_float(row.get("涨跌幅"))
        rows.append((date_text, close, change_rate))

    if indicator == "累计收益率走势":
        closes = [item[1] for item in rows]
        values = _compute_cumulative_returns(closes)
        return [
            FundCurvePoint(
                date=date_text,
                value=value,
                nav=close,
                change_rate=change_rate,
            )
            for (date_text, close, change_rate), value in zip(rows, values, strict=False)
        ]

    return [
        FundCurvePoint(date=date_text, value=close, nav=close, change_rate=change_rate)
        for date_text, close, change_rate in rows
    ]


def _load_curve_sync(
    code: str,
    kind: FundCurveKind,
    indicator: FundCurveIndicator,
    period: FundCurvePeriod,
) -> list[FundCurvePoint]:
    cache_key = f"curve:{kind}:{code}:{indicator}:{period}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    if kind == "open":
        points = _load_open_curve_sync(code, indicator, period)
    else:
        points = _load_market_curve_sync(code, kind, indicator, period)

    _cache.set(cache_key, points)
    return points


async def get_fund_curve(
    code: str,
    *,
    indicator: FundCurveIndicator = "累计收益率走势",
    period: FundCurvePeriod = "1年",
    name: str = "",
) -> FundCurveResponse:
    normalized = code.strip()
    if not normalized:
        raise ValueError("基金代码不能为空")

    kind = await asyncio.to_thread(_detect_fund_kind_sync, normalized)
    points = await asyncio.to_thread(_load_curve_sync, normalized, kind, indicator, period)
    return FundCurveResponse(
        code=normalized,
        name=name,
        kind=kind,
        source_api=KIND_SOURCE_API[kind],
        indicator=indicator,
        period=period if indicator == "累计收益率走势" else "",
        points=points,
        updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )


async def get_fund_curve_options(code: str = "") -> FundCurveOptionsResponse:
    kind: FundCurveKind = "open"
    if code.strip():
        kind = await asyncio.to_thread(_detect_fund_kind_sync, code.strip())

    labels = KIND_INDICATOR_LABELS[kind]
    return FundCurveOptionsResponse(
        kind=kind,
        source_api=KIND_SOURCE_API[kind],
        indicators=[
            {"value": key, "label": labels[key]}
            for key in ("累计收益率走势", "单位净值走势")
        ],
        periods=CURVE_PERIODS,
    )
