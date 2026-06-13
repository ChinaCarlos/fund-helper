from __future__ import annotations

import asyncio
import math
import re
import time
from datetime import datetime
from typing import Any

import akshare as ak
import pandas as pd

from app.market.schemas import (
    DIMENSION_LABELS,
    FundFieldMeta,
    FundRankItem,
    FundRankOptionsResponse,
    FundRankResponse,
    RankDimension,
    RankScope,
)
from app.services.poller import is_trading_hours

OPEN_FUND_TYPES = ["全部", "股票型", "混合型", "债券型", "指数型", "QDII", "LOF", "FOF"]
INDEX_BOARDS = [
    "全部",
    "行业主题",
    "沪深指数",
    "大盘指数",
    "中盘指数",
    "小盘指数",
    "股票指数",
    "债券指数",
]

SECTOR_KEYWORDS = [
    "白酒", "新能源", "新能车", "光伏", "储能", "电池", "半导体", "芯片", "集成电路",
    "医药", "医疗", "生物", "消费", "食品饮料", "军工", "国防", "证券", "券商", "银行",
    "地产", "房地产", "有色", "金属", "煤炭", "钢铁", "农业", "养殖", "汽车", "机器人",
    "人工智能", "通信", "5G", "电力", "红利", "央企", "国企", "港股", "恒生", "美股",
    "纳斯达克", "标普", "黄金", "国债", "科创", "创业板", "沪深300", "中证500", "上证50",
    "信息技术", "互联网", "传媒", "文娱", "游戏", "云计算", "大数据", "物联网", "环保",
    "碳中和", "稀土", "化工", "建材", "家电", "物流", "航运", "航空", "旅游", "教育",
    "保险", "信托",
]

AVAILABLE_FIELDS: list[FundFieldMeta] = [
    FundFieldMeta(key="code", label="基金代码", source="排行接口", description="6 位基金代码"),
    FundFieldMeta(key="name", label="基金简称", source="排行接口"),
    FundFieldMeta(key="nav", label="单位净值", source="排行接口", description="最新公布单位净值"),
    FundFieldMeta(key="acc_nav", label="累计净值", source="开放式排行", description="指数板块接口无此字段"),
    FundFieldMeta(key="nav_date", label="净值日期", source="排行接口"),
    FundFieldMeta(key="day", label="当天涨幅", source="排行接口", description="日增长率（%）"),
    FundFieldMeta(key="estimate_nav", label="估算净值", source="实时估值", description="交易时段盘中估算净值"),
    FundFieldMeta(key="estimate_rate", label="实时估计涨幅", source="实时估值", description="仅交易时段展示，盘中估算涨跌幅（%）"),
    FundFieldMeta(key="estimate_deviation", label="估算偏差", source="实时估值", description="估算值与公布净值偏差（%）"),
    FundFieldMeta(key="published_day_rate", label="公布日涨幅", source="实时估值", description="最新公布净值日涨跌幅（%）"),
    FundFieldMeta(key="week1", label="近 1 周", source="排行接口"),
    FundFieldMeta(key="month1", label="近 1 月", source="排行接口"),
    FundFieldMeta(key="month3", label="近 3 月", source="排行接口"),
    FundFieldMeta(key="month6", label="近 6 月", source="排行接口"),
    FundFieldMeta(key="year1", label="近 1 年", source="排行接口"),
    FundFieldMeta(key="year2", label="近 2 年", source="排行接口"),
    FundFieldMeta(key="year3", label="近 3 年", source="排行接口"),
    FundFieldMeta(key="ytd", label="今年来", source="排行接口"),
    FundFieldMeta(key="since_found", label="成立来", source="排行接口"),
    FundFieldMeta(key="custom_rate", label="自定义", source="开放式排行", description="仅开放式基金排行"),
    FundFieldMeta(key="fund_type", label="基金类型", source="基金名录", description="fund_name_em 合并"),
    FundFieldMeta(key="sector", label="板块/主题", source="推导", description="简称关键词或指数跟踪标的"),
    FundFieldMeta(key="fee", label="手续费", source="排行接口"),
    FundFieldMeta(key="min_purchase", label="起购金额", source="指数板块", description="仅指数板块数据"),
    FundFieldMeta(key="tracking_target", label="跟踪标的", source="指数板块"),
    FundFieldMeta(key="tracking_method", label="跟踪方式", source="指数板块"),
]

CACHE_TTL_SECONDS = 600
ESTIMATE_CACHE_TTL_SECONDS = 90


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
_estimate_cache = _TimedCache(ttl=ESTIMATE_CACHE_TTL_SECONDS)


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
    if isinstance(value, str):
        text = value.strip().replace("%", "").replace(",", "")
        if not text or text in {"---", "--", "-"}:
            return None
        try:
            return float(text)
        except ValueError:
            return None
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


def _row_to_metrics(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "code": _safe_str(row.get("code")),
        "name": _safe_str(row.get("name")),
        "nav": _safe_float(row.get("nav")),
        "acc_nav": _safe_float(row.get("acc_nav")),
        "nav_date": _safe_str(row.get("nav_date")),
        "day": _safe_float(row.get("day")),
        "week1": _safe_float(row.get("week1")),
        "month1": _safe_float(row.get("month1")),
        "month3": _safe_float(row.get("month3")),
        "month6": _safe_float(row.get("month6")),
        "year1": _safe_float(row.get("year1")),
        "year2": _safe_float(row.get("year2")),
        "year3": _safe_float(row.get("year3")),
        "ytd": _safe_float(row.get("ytd")),
        "since_found": _safe_float(row.get("since_found")),
        "custom_rate": _safe_float(row.get("custom_rate")),
        "fee": _safe_str(row.get("fee")),
        "fund_type": _safe_str(row.get("fund_type")),
        "sector": _safe_str(row.get("sector")),
        "board": _safe_str(row.get("board")),
        "min_purchase": _safe_str(row.get("min_purchase")),
        "tracking_target": _safe_str(row.get("tracking_target")),
        "tracking_method": _safe_str(row.get("tracking_method")),
        "estimate_nav": _safe_float(row.get("estimate_nav")),
        "estimate_rate": _safe_float(row.get("estimate_rate")),
        "estimate_deviation": _safe_float(row.get("estimate_deviation")),
        "published_day_rate": _safe_float(row.get("published_day_rate")),
    }


def _normalize_open_df(df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        rows.append(
            {
                "code": _safe_str(row.get("基金代码")),
                "name": _safe_str(row.get("基金简称")),
                "nav": _safe_float(row.get("单位净值")),
                "acc_nav": _safe_float(row.get("累计净值")),
                "nav_date": _safe_str(row.get("日期")),
                "day": _safe_float(row.get("日增长率")),
                "week1": _safe_float(row.get("近1周")),
                "month1": _safe_float(row.get("近1月")),
                "month3": _safe_float(row.get("近3月")),
                "month6": _safe_float(row.get("近6月")),
                "year1": _safe_float(row.get("近1年")),
                "year2": _safe_float(row.get("近2年")),
                "year3": _safe_float(row.get("近3年")),
                "ytd": _safe_float(row.get("今年来")),
                "since_found": _safe_float(row.get("成立来")),
                "custom_rate": _safe_float(row.get("自定义")),
                "fee": _safe_str(row.get("手续费")),
                "fund_type": "",
                "sector": "",
                "board": "",
                "min_purchase": "",
                "tracking_target": "",
                "tracking_method": "",
                "estimate_nav": None,
                "estimate_rate": None,
                "estimate_deviation": None,
                "published_day_rate": None,
            }
        )
    return pd.DataFrame(rows)


def _normalize_index_df(df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        tracking = _safe_str(row.get("跟踪标的"))
        rows.append(
            {
                "code": _safe_str(row.get("基金代码")),
                "name": _safe_str(row.get("基金名称")),
                "nav": _safe_float(row.get("单位净值")),
                "acc_nav": None,
                "nav_date": _safe_str(row.get("日期")),
                "day": _safe_float(row.get("日增长率")),
                "week1": _safe_float(row.get("近1周")),
                "month1": _safe_float(row.get("近1月")),
                "month3": _safe_float(row.get("近3月")),
                "month6": _safe_float(row.get("近6月")),
                "year1": _safe_float(row.get("近1年")),
                "year2": _safe_float(row.get("近2年")),
                "year3": _safe_float(row.get("近3年")),
                "ytd": _safe_float(row.get("今年来")),
                "since_found": _safe_float(row.get("成立来")),
                "custom_rate": None,
                "fee": _safe_str(row.get("手续费")),
                "fund_type": "指数型",
                "sector": tracking,
                "board": tracking,
                "min_purchase": _safe_str(row.get("起购金额")),
                "tracking_target": tracking,
                "tracking_method": _safe_str(row.get("跟踪方式")),
                "estimate_nav": None,
                "estimate_rate": None,
                "estimate_deviation": None,
                "published_day_rate": None,
            }
        )
    return pd.DataFrame(rows)


def _normalize_estimate_df(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    columns = list(df.columns)
    estimate_nav_col = _pick_column(columns, "估算数据-估算值")
    estimate_rate_col = _pick_column(columns, "估算数据-估算增长率")
    published_nav_col = _pick_column(columns, "公布数据-单位净值")
    published_rate_col = _pick_column(columns, "公布数据-日增长率")
    deviation_col = _pick_column(columns, "估算偏差")

    mapping: dict[str, dict[str, Any]] = {}
    for _, row in df.iterrows():
        code = _safe_str(row.get("基金代码"))
        if not code:
            continue
        mapping[code] = {
            "estimate_nav": _safe_float(row.get(estimate_nav_col)) if estimate_nav_col else None,
            "estimate_rate": _safe_float(row.get(estimate_rate_col)) if estimate_rate_col else None,
            "estimate_deviation": _safe_float(row.get(deviation_col)) if deviation_col else None,
            "published_day_rate": _safe_float(row.get(published_rate_col)) if published_rate_col else None,
            "published_nav": _safe_float(row.get(published_nav_col)) if published_nav_col else None,
        }
    return mapping


def _detect_sector(name: str) -> str:
    for keyword in SECTOR_KEYWORDS:
        if keyword in name:
            return keyword
    return ""


def _load_open_rank_sync(fund_type: str) -> pd.DataFrame:
    cache_key = f"open:{fund_type}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached.copy()

    raw = ak.fund_open_fund_rank_em(symbol=fund_type)
    df = _normalize_open_df(raw)
    _cache.set(cache_key, df)
    return df.copy()


def _load_index_rank_sync(board: str) -> pd.DataFrame:
    cache_key = f"index:{board}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached.copy()

    raw = ak.fund_info_index_em(symbol=board, indicator="全部")
    df = _normalize_index_df(raw)
    _cache.set(cache_key, df)
    return df.copy()


def _load_fund_types_sync() -> dict[str, str]:
    cached = _cache.get("fund_types")
    if cached is not None:
        return dict(cached)

    raw = ak.fund_name_em()
    mapping = {
        _safe_str(row["基金代码"]): _safe_str(row["基金类型"])
        for _, row in raw.iterrows()
        if _safe_str(row.get("基金代码"))
    }
    _cache.set("fund_types", mapping)
    return mapping


def _load_estimate_sync() -> dict[str, dict[str, Any]]:
    cached = _estimate_cache.get("estimate")
    if cached is not None:
        return dict(cached)

    raw = ak.fund_value_estimation_em()
    mapping = _normalize_estimate_df(raw)
    _estimate_cache.set("estimate", mapping, ttl=ESTIMATE_CACHE_TTL_SECONDS)
    return mapping


async def _load_open_rank(fund_type: str) -> pd.DataFrame:
    return await asyncio.to_thread(_load_open_rank_sync, fund_type)


async def _load_index_rank(board: str) -> pd.DataFrame:
    return await asyncio.to_thread(_load_index_rank_sync, board)


async def _load_fund_types() -> dict[str, str]:
    return await asyncio.to_thread(_load_fund_types_sync)


async def _load_estimate() -> dict[str, dict[str, Any]]:
    return await asyncio.to_thread(_load_estimate_sync)


def _merge_estimate(df: pd.DataFrame, estimate_map: dict[str, dict[str, Any]]) -> pd.DataFrame:
    if df.empty or not estimate_map:
        return df

    working = df.copy()

    def apply_estimate(row: pd.Series) -> pd.Series:
        code = _safe_str(row.get("code"))
        est = estimate_map.get(code)
        if not est:
            return row
        for key in ("estimate_nav", "estimate_rate", "estimate_deviation", "published_day_rate"):
            if row.get(key) is None and est.get(key) is not None:
                row[key] = est[key]
        return row

    return working.apply(apply_estimate, axis=1)


def _apply_filters(
    df: pd.DataFrame,
    *,
    dimension: RankDimension,
    sector: str,
    fund_type_filter: str,
    type_map: dict[str, str],
) -> pd.DataFrame:
    if df.empty:
        return df

    working = df.copy()
    if "fund_type" not in working.columns:
        working["fund_type"] = ""

    if type_map:
        working["fund_type"] = working.apply(
            lambda row: type_map.get(_safe_str(row.get("code")), _safe_str(row.get("fund_type"))),
            axis=1,
        )

    working["sector"] = working.apply(
        lambda row: _safe_str(row.get("sector")) or _detect_sector(_safe_str(row.get("name"))),
        axis=1,
    )

    if fund_type_filter and fund_type_filter != "全部":
        working = working[working["fund_type"].str.contains(fund_type_filter, na=False, regex=False)]

    if sector:
        pattern = re.escape(sector)
        working = working[
            working["name"].str.contains(pattern, na=False, regex=True)
            | working["sector"].str.contains(pattern, na=False, regex=True)
        ]

    working = working[working[dimension].notna()]
    return working


def _paginate_items(
    df: pd.DataFrame,
    *,
    dimension: RankDimension,
    page: int,
    page_size: int,
    order: str,
) -> list[FundRankItem]:
    if df.empty:
        return []

    ascending = order == "asc"
    sorted_df = df.sort_values(by=dimension, ascending=ascending, na_position="last")
    start = (page - 1) * page_size
    end = start + page_size
    page_df = sorted_df.iloc[start:end]

    items: list[FundRankItem] = []
    for offset, (_, row) in enumerate(page_df.iterrows()):
        metrics = _row_to_metrics(row.to_dict())
        change_rate = _safe_float(row.get(dimension))
        items.append(
            FundRankItem(
                rank=start + offset + 1,
                change_rate=change_rate,
                **metrics,
            )
        )
    return items


async def get_fund_rank(
    *,
    dimension: RankDimension = "day",
    scope: RankScope = "open",
    fund_type: str = "全部",
    board: str = "全部",
    sector: str = "",
    page: int = 1,
    page_size: int = 20,
    order: str = "desc",
) -> FundRankResponse:
    if fund_type not in OPEN_FUND_TYPES:
        fund_type = "全部"
    if board not in INDEX_BOARDS:
        board = "全部"
    page = max(1, page)
    page_size = max(1, min(page_size, 100))

    type_map: dict[str, str] = {}
    if scope == "open":
        df, type_map, estimate_map = await asyncio.gather(
            _load_open_rank(fund_type),
            _load_fund_types(),
            _load_estimate(),
        )
        active_fund_type = fund_type
        active_board = ""
    else:
        df, estimate_map = await asyncio.gather(
            _load_index_rank(board),
            _load_estimate(),
        )
        active_fund_type = ""
        active_board = board

    df = _merge_estimate(df, estimate_map)
    filtered = _apply_filters(
        df,
        dimension=dimension,
        sector=sector,
        fund_type_filter=fund_type if scope == "open" else "",
        type_map=type_map,
    )
    items = _paginate_items(
        filtered,
        dimension=dimension,
        page=page,
        page_size=page_size,
        order=order,
    )

    return FundRankResponse(
        dimension=dimension,
        dimension_label=DIMENSION_LABELS[dimension],
        scope=scope,
        fund_type=active_fund_type,
        board=active_board,
        sector=sector,
        trading=is_trading_hours(),
        total=len(filtered),
        page=page,
        page_size=page_size,
        updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        items=items,
    )


async def get_fund_rank_options() -> FundRankOptionsResponse:
    return FundRankOptionsResponse(
        dimensions=[
            {"value": key, "label": label}
            for key, label in DIMENSION_LABELS.items()
        ],
        fund_types=OPEN_FUND_TYPES,
        index_boards=INDEX_BOARDS,
        sectors=SECTOR_KEYWORDS,
        available_fields=AVAILABLE_FIELDS,
    )
