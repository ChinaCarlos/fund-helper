from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from app.config import settings
from app.services.broadcaster import Broadcaster
from app.yjb.auth_store import AuthStore
from app.yjb.calculator import build_portfolio_snapshot
from app.yjb.client import YjbApiError, YjbClient

logger = logging.getLogger(__name__)


def is_trading_hours() -> bool:
    now = datetime.now()
    if now.weekday() >= 5:
        return False
    minutes = now.hour * 60 + now.minute
    morning = 9 * 60 + 30 <= minutes <= 11 * 60 + 31
    afternoon = 13 * 60 + 30 <= minutes <= 15 * 60 + 1
    return morning or afternoon


class PortfolioPoller:
    def __init__(self, auth_store: AuthStore, broadcaster: Broadcaster):
        self.auth_store = auth_store
        self.broadcaster = broadcaster
        self._task: asyncio.Task | None = None
        self._latest: dict | None = None

    @property
    def latest(self) -> dict | None:
        return self._latest

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

    async def poll_once(self) -> None:
        try:
            snapshot = await self.fetch_snapshot()
            self._latest = snapshot
            await self.broadcaster.broadcast(
                {"type": "portfolio_update", "data": snapshot}
            )
        except YjbApiError as exc:
            if exc.status_code == 401:
                self.auth_store.clear()
                await self.broadcaster.broadcast({"type": "auth_required"})
            else:
                await self.broadcaster.broadcast(
                    {"type": "error", "message": str(exc)}
                )
        except Exception as exc:
            logger.exception("poll failed")
            await self.broadcaster.broadcast(
                {"type": "error", "message": f"数据拉取失败: {exc}"}
            )

    async def _loop(self) -> None:
        while True:
            if not self.auth_store.session.is_valid:
                await asyncio.sleep(settings.idle_check_interval)
                continue

            if is_trading_hours():
                await self.poll_once()
                await asyncio.sleep(settings.poll_interval)
            else:
                # 非交易时段不拉取行情，仅定期唤醒检查是否进入交易时段
                await asyncio.sleep(settings.idle_check_interval)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop())

    def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
