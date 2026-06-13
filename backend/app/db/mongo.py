from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings
from app.db.collections import NOTIFICATION_CONFIGS, SESSIONS, USERS

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_mongodb() -> AsyncIOMotorDatabase:
    global _client, _database
    if _database is not None:
        return _database

    _client = AsyncIOMotorClient(settings.mongodb_uri)
    _database = _client[settings.mongodb_db]

    await _client.admin.command("ping")
    await _ensure_indexes(_database)
    logger.info("MongoDB connected: %s / %s", settings.mongodb_uri, settings.mongodb_db)
    return _database


async def close_mongodb() -> None:
    global _client, _database
    if _client is not None:
        _client.close()
    _client = None
    _database = None


def get_database() -> AsyncIOMotorDatabase:
    if _database is None:
        raise RuntimeError("MongoDB not connected")
    return _database


async def _drop_legacy_indexes(
    collection,
    *,
    allowed: set[str],
    label: str,
) -> None:
    for name in await collection.index_information():
        if name in allowed:
            continue
        await collection.drop_index(name)
        logger.warning("Dropped legacy index %s on %s", name, label)


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    users = db[USERS]
    sessions = db[SESSIONS]
    notify = db[NOTIFICATION_CONFIGS]

    # 旧版 email 注册方案遗留的 unique index 会导致多条无 email 文档冲突
    await _drop_legacy_indexes(
        users,
        allowed={"_id_", "username_1", "updated_at_1"},
        label=USERS,
    )
    await _drop_legacy_indexes(
        sessions,
        allowed={"_id_", "user_id_1", "expires_at_1"},
        label=SESSIONS,
    )
    await _drop_legacy_indexes(
        notify,
        allowed={"_id_", "updated_at_1"},
        label=NOTIFICATION_CONFIGS,
    )

    await users.create_index("username", unique=True)
    await users.create_index("updated_at")
    await sessions.create_index("user_id")
    await sessions.create_index("expires_at", expireAfterSeconds=0)
    await notify.create_index("updated_at")
