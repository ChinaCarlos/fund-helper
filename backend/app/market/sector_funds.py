from __future__ import annotations

import asyncio
from datetime import datetime

from app.market.fund_rank import get_fund_rank
from app.market.schemas import FundRankItem, HeatmapBoardType, SectorFundsResponse
from app.services.poller import is_trading_hours


async def get_sector_funds(
    *,
    sector: str,
    board_type: HeatmapBoardType = "industry",
    limit: int = 50,
) -> SectorFundsResponse:
    normalized = sector.strip()
    if not normalized:
        raise ValueError("板块名称不能为空")

    limit = max(1, min(limit, 100))

    open_result, index_result = await asyncio.gather(
        get_fund_rank(
            dimension="day",
            scope="open",
            sector=normalized,
            page=1,
            page_size=limit,
            order="desc",
        ),
        get_fund_rank(
            dimension="day",
            scope="index",
            sector=normalized,
            page=1,
            page_size=limit,
            order="desc",
        ),
    )

    merged: dict[str, FundRankItem] = {}
    for item in [*open_result.items, *index_result.items]:
        day_value = item.day if item.day is not None else float("-inf")
        existing = merged.get(item.code)
        if existing is None:
            merged[item.code] = item
            continue
        existing_day = existing.day if existing.day is not None else float("-inf")
        if day_value > existing_day:
            merged[item.code] = item

    sorted_items = sorted(
        merged.values(),
        key=lambda item: item.day if item.day is not None else float("-inf"),
        reverse=True,
    )[:limit]

    ranked: list[FundRankItem] = []
    for index, item in enumerate(sorted_items, start=1):
        ranked.append(item.model_copy(update={"rank": index}))

    return SectorFundsResponse(
        sector=normalized,
        board_type=board_type,
        total=len(ranked),
        items=ranked,
        trading=is_trading_hours(),
        updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )
