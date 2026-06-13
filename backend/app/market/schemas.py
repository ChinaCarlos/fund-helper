from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

RankDimension = Literal[
    "day",
    "week1",
    "month1",
    "month3",
    "month6",
    "year1",
    "year2",
    "year3",
    "estimate_rate",
]
RankScope = Literal["open", "index"]

DIMENSION_LABELS: dict[str, str] = {
    "day": "当天涨幅",
    "week1": "近 1 周涨幅",
    "month1": "近 1 月涨幅",
    "month3": "近 3 月涨幅",
    "month6": "近 6 月涨幅",
    "year1": "近 1 年涨幅",
    "year2": "近 2 年涨幅",
    "year3": "近 3 年涨幅",
    "estimate_rate": "实时估计涨幅",
}


class FundFieldMeta(BaseModel):
    key: str
    label: str
    source: str
    description: str = ""


class FundRankItem(BaseModel):
    rank: int
    code: str
    name: str
    nav: float | None = None
    acc_nav: float | None = None
    nav_date: str = ""
    day: float | None = None
    change_rate: float | None = None
    estimate_nav: float | None = None
    estimate_rate: float | None = None
    estimate_deviation: float | None = None
    published_day_rate: float | None = None
    week1: float | None = None
    month1: float | None = None
    month3: float | None = None
    month6: float | None = None
    year1: float | None = None
    year2: float | None = None
    year3: float | None = None
    ytd: float | None = None
    since_found: float | None = None
    custom_rate: float | None = None
    fund_type: str = ""
    sector: str = ""
    fee: str = ""
    min_purchase: str = ""
    tracking_target: str = ""
    tracking_method: str = ""


class FundRankResponse(BaseModel):
    dimension: RankDimension
    dimension_label: str
    scope: RankScope
    fund_type: str = ""
    board: str = ""
    sector: str = ""
    search: str = ""
    trading: bool = False
    total: int
    page: int
    page_size: int
    updated_at: str
    items: list[FundRankItem] = Field(default_factory=list)


class FundRankOptionsResponse(BaseModel):
    dimensions: list[dict[str, str]]
    fund_types: list[str]
    index_boards: list[str]
    sectors: list[str]
    available_fields: list[FundFieldMeta] = Field(default_factory=list)


HeatmapKind = Literal["sector_change", "fund_flow"]
HeatmapBoardType = Literal["industry", "concept"]
FundFlowIndicator = Literal["今日", "5日", "10日"]
FundCurveIndicator = Literal["累计收益率走势", "单位净值走势"]
FundCurvePeriod = Literal["1月", "3月", "6月", "1年", "3年", "5年", "今年来", "成立来"]
FundCurveKind = Literal["open", "etf", "lof"]


class HeatmapItem(BaseModel):
    name: str
    code: str = ""
    change_rate: float | None = None
    net_flow: float | None = None
    net_flow_ratio: float | None = None
    leading_stock: str = ""
    leading_stock_change: float | None = None
    up_count: int | None = None
    down_count: int | None = None


class HeatmapResponse(BaseModel):
    kind: HeatmapKind
    board_type: HeatmapBoardType
    indicator: str = ""
    trading: bool = False
    updated_at: str
    items: list[HeatmapItem] = Field(default_factory=list)


class HeatmapOptionsResponse(BaseModel):
    kinds: list[dict[str, str]]
    board_types: list[dict[str, str]]
    flow_indicators: list[str]
    sources: list[dict[str, str]]


class FundCurvePoint(BaseModel):
    date: str
    value: float | None = None
    nav: float | None = None
    change_rate: float | None = None


class FundCurveResponse(BaseModel):
    code: str
    name: str = ""
    kind: FundCurveKind = "open"
    source_api: str = "fund_open_fund_info_em"
    indicator: FundCurveIndicator
    period: str
    points: list[FundCurvePoint] = Field(default_factory=list)
    updated_at: str = ""


class FundCurveOptionsResponse(BaseModel):
    kind: FundCurveKind = "open"
    source_api: str = "fund_open_fund_info_em"
    indicators: list[dict[str, str]]
    periods: list[str]


class SectorFundsResponse(BaseModel):
    sector: str
    board_type: HeatmapBoardType = "industry"
    total: int
    items: list[FundRankItem] = Field(default_factory=list)
    trading: bool = False
    updated_at: str = ""


class CurveOverlayPoint(BaseModel):
    date: str
    value: float | None = None


class CurveOverlaySeries(BaseModel):
    key: str
    label: str
    points: list[CurveOverlayPoint] = Field(default_factory=list)


class CurveOverlaysResponse(BaseModel):
    period: str
    sector_name: str = ""
    board_type: str = "industry"
    series: list[CurveOverlaySeries] = Field(default_factory=list)
    updated_at: str = ""
