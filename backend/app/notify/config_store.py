from __future__ import annotations

from datetime import UTC, datetime

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.collections import NOTIFICATION_CONFIGS
from app.notify.schemas import NotificationConfig


class NotificationConfigStore:
    """按 user_id 持久化通知配置到 MongoDB `notification_configs` 集合。"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[NOTIFICATION_CONFIGS]

    async def load(self, user_id: str) -> NotificationConfig | None:
        doc = await self._collection.find_one({"_id": user_id})
        if not doc:
            return None
        payload = {key: value for key, value in doc.items() if key not in {"_id", "updated_at"}}
        try:
            return NotificationConfig.model_validate(payload)
        except ValueError:
            return None

    async def save(self, user_id: str, config: NotificationConfig) -> NotificationConfig:
        payload = config.model_dump()
        payload["_id"] = user_id
        payload["updated_at"] = datetime.now(UTC)
        await self._collection.replace_one({"_id": user_id}, payload, upsert=True)
        return config

    async def clear(self, user_id: str) -> None:
        await self._collection.delete_one({"_id": user_id})
