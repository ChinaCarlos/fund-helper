from __future__ import annotations

from typing import Literal

NotifyContentType = Literal[
    "portfolio",
    "fund_gain_top20",
    "fund_loss_top20",
    "fund_est_gain_top20",
    "fund_est_loss_top20",
    "sector_change_top10",
    "sector_flow_top10",
]

ALL_CONTENT_TYPES: tuple[NotifyContentType, ...] = (
    "portfolio",
    "fund_gain_top20",
    "fund_loss_top20",
    "fund_est_gain_top20",
    "fund_est_loss_top20",
    "sector_change_top10",
    "sector_flow_top10",
)

DEFAULT_CONTENT_TYPES: list[NotifyContentType] = ["portfolio"]

CONTENT_TYPE_LABELS: dict[NotifyContentType, str] = {
    "portfolio": "持仓盈亏",
    "fund_gain_top20": "涨幅榜 Top20",
    "fund_loss_top20": "跌幅榜 Top20",
    "fund_est_gain_top20": "预估涨幅 Top20",
    "fund_est_loss_top20": "预估跌幅 Top20",
    "sector_change_top10": "板块涨跌 Top10",
    "sector_flow_top10": "板块资金 Top10",
}

CONTENT_TYPE_DESCRIPTIONS: dict[NotifyContentType, str] = {
    "portfolio": "推送当前持仓总资产、当日收益、涨跌分布及分组明细（需绑定养基宝）",
    "fund_gain_top20": "全市场开放式基金当日公布涨幅前 20 名",
    "fund_loss_top20": "全市场开放式基金当日公布跌幅前 20 名",
    "fund_est_gain_top20": "交易时段盘中实时估算涨幅前 20 名（含估值净值）",
    "fund_est_loss_top20": "交易时段盘中实时估算跌幅前 20 名（含估值净值）",
    "sector_change_top10": "行业与概念板块当日涨幅前 10、跌幅前 10",
    "sector_flow_top10": "行业与概念板块当日主力净流入前 10、净流出前 10",
}


def normalize_content_types(raw: list[str] | None) -> list[NotifyContentType]:
    if not raw:
        return list(DEFAULT_CONTENT_TYPES)
    seen: set[str] = set()
    result: list[NotifyContentType] = []
    for item in raw:
        if item in ALL_CONTENT_TYPES and item not in seen:
            seen.add(item)
            result.append(item)  # type: ignore[arg-type]
    return result or list(DEFAULT_CONTENT_TYPES)
