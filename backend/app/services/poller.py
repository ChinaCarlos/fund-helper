from __future__ import annotations

import asyncio
from datetime import datetime

from app.yjb.auth_store import AuthStore
from app.yjb.calculator import build_portfolio_snapshot
from app.yjb.client import YjbApiError, YjbClient


def is_trading_hours() -> bool:
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    minutes = now.hour * 60 + now.minute
    morning = 9 * 60 + 30 <= minutes <= 11 * 60 + 31
    afternoon = 13 * 60 + 30 <= minutes <= 15 * 60 + 1
    return morning or afternoon


class PortfolioPoller:
    """按需拉取持仓快照（无后台轮询、无 WebSocket）。"""

    def __init__(self, auth_store: AuthStore):
        self.auth_store = auth_store

    async def fetch_snapshot(self) -> dict:
        session = self.auth_store.session
        if not session.is_valid:
            raise YjbApiError("未登录", status_code=401)

        client = YjbClient(token=session.token)
        try:
            collect, indices = await asyncio.gather(
                client.get_collect(),
                client.get_index(),
            )

            funds_by_account: dict[int, list] = {}
            for acc in collect.get("account_data", []):
                account_id = acc["account_id"]
                funds_by_account[account_id] = await client.get_funds(account_id)

            snapshot = build_portfolio_snapshot(
                collect=collect,
                funds_by_account=funds_by_account,
                indices=indices,
            )
            snapshot["updated_at"] = datetime.now().isoformat(timespec="seconds")
            snapshot["user"] = {
                "nickname": session.nickname,
                "avatar": session.avatar,
            }
            snapshot["trading"] = is_trading_hours()
            return snapshot
        finally:
            await client.close()
