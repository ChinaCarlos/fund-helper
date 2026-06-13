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
