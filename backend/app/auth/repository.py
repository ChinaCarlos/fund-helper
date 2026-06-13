from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.auth.models import Session, User
from app.auth.password import hash_password, verify_password
from app.auth.utils import normalize_avatar_url
from app.config import settings
from app.db.collections import SESSIONS, USERS


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[USERS]

    async def ensure_default_admin(self) -> None:
        existing = await self._collection.find_one({"username": settings.admin_username})
        if existing:
            return
        now = datetime.now(UTC)
        await self._collection.insert_one(
            {
                "_id": str(uuid.uuid4()),
                "username": settings.admin_username,
                "password_hash": hash_password(settings.admin_password),
                "role": "admin",
                "is_active": True,
                "yjb_token": "",
                "yjb_nickname": "",
                "yjb_avatar": "",
                "yjb_login_time": "",
                "created_at": now,
                "updated_at": now,
            }
        )

    async def get_by_id(self, user_id: str) -> User | None:
        doc = await self._collection.find_one({"_id": user_id})
        return _user_from_doc(doc) if doc else None

    async def get_by_username(self, username: str) -> User | None:
        doc = await self._collection.find_one({"username": username})
        return _user_from_doc(doc) if doc else None

    async def authenticate(self, username: str, password: str) -> User | None:
        doc = await self._collection.find_one({"username": username})
        if not doc or not doc.get("is_active", True):
            return None
        if not verify_password(password, str(doc.get("password_hash", ""))):
            return None
        return _user_from_doc(doc)

    async def list_users(self) -> list[User]:
        cursor = self._collection.find().sort("created_at", 1)
        return [_user_from_doc(doc) async for doc in cursor]

    async def count_admins(self) -> int:
        return await self._collection.count_documents({"role": "admin", "is_active": True})

    async def create_user(
        self,
        *,
        username: str,
        password: str,
        role: str = "user",
    ) -> User:
        username = username.strip()
        if await self._collection.find_one({"username": username}):
            raise ValueError("用户名已存在")
        now = datetime.now(UTC)
        user_id = str(uuid.uuid4())
        try:
            await self._collection.insert_one(
                {
                    "_id": user_id,
                    "username": username,
                    "password_hash": hash_password(password),
                    "role": role,
                    "is_active": True,
                    "yjb_token": "",
                    "yjb_nickname": "",
                    "yjb_avatar": "",
                    "yjb_login_time": "",
                    "created_at": now,
                    "updated_at": now,
                }
            )
        except DuplicateKeyError as exc:
            detail = str(exc)
            if "username" in detail:
                raise ValueError("用户名已存在") from exc
            raise ValueError("用户数据冲突，请重启后端以清理旧数据库索引") from exc
        user = await self.get_by_id(user_id)
        if user is None:
            raise RuntimeError("failed to create user")
        return user

    async def update_user(
        self,
        user_id: str,
        *,
        password: str | None = None,
        role: str | None = None,
        is_active: bool | None = None,
    ) -> User:
        updates: dict = {"updated_at": datetime.now(UTC)}
        if password is not None:
            updates["password_hash"] = hash_password(password)
        if role is not None:
            updates["role"] = role
        if is_active is not None:
            updates["is_active"] = is_active
        result = await self._collection.update_one({"_id": user_id}, {"$set": updates})
        if result.matched_count == 0:
            raise ValueError("用户不存在")
        user = await self.get_by_id(user_id)
        if user is None:
            raise RuntimeError("failed to load user")
        return user

    async def delete_user(self, user_id: str) -> None:
        result = await self._collection.delete_one({"_id": user_id})
        if result.deleted_count == 0:
            raise ValueError("用户不存在")

    async def change_password(
        self,
        user_id: str,
        *,
        current_password: str,
        new_password: str,
    ) -> None:
        doc = await self._collection.find_one({"_id": user_id})
        if not doc:
            raise ValueError("用户不存在")
        if not verify_password(current_password, str(doc.get("password_hash", ""))):
            raise ValueError("当前密码不正确")
        await self._collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "password_hash": hash_password(new_password),
                    "updated_at": datetime.now(UTC),
                }
            },
        )

    async def bind_yjb(
        self,
        user_id: str,
        *,
        token: str,
        nickname: str,
        avatar: str,
    ) -> User:
        avatar = normalize_avatar_url(avatar)
        login_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await self._collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "yjb_token": token,
                    "yjb_nickname": nickname,
                    "yjb_avatar": avatar,
                    "yjb_login_time": login_time,
                    "updated_at": datetime.now(UTC),
                }
            },
        )
        user = await self.get_by_id(user_id)
        if user is None:
            raise RuntimeError("failed to bind yjb")
        return user

    async def clear_yjb(self, user_id: str) -> None:
        await self._collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "yjb_token": "",
                    "yjb_nickname": "",
                    "yjb_avatar": "",
                    "yjb_login_time": "",
                    "updated_at": datetime.now(UTC),
                }
            },
        )


class SessionRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db[SESSIONS]

    async def create(self, user_id: str) -> Session:
        session_id = str(uuid.uuid4())
        now = datetime.now(UTC)
        expires_at = now + timedelta(days=settings.session_max_age_days)
        await self._collection.insert_one(
            {
                "_id": session_id,
                "user_id": user_id,
                "created_at": now,
                "last_seen_at": now,
                "expires_at": expires_at,
            }
        )
        return Session(session_id=session_id, user_id=user_id, expires_at=expires_at)

    async def get(self, session_id: str) -> Session | None:
        doc = await self._collection.find_one({"_id": session_id})
        if not doc:
            return None
        expires_at = doc.get("expires_at")
        if not isinstance(expires_at, datetime):
            return None
        session = Session(
            session_id=str(doc["_id"]),
            user_id=str(doc["user_id"]),
            expires_at=expires_at,
        )
        if session.is_expired:
            await self.delete(session_id)
            return None
        return session

    async def touch(self, session_id: str) -> None:
        await self._collection.update_one(
            {"_id": session_id},
            {"$set": {"last_seen_at": datetime.now(UTC)}},
        )

    async def delete(self, session_id: str) -> None:
        await self._collection.delete_one({"_id": session_id})

    async def delete_by_user(self, user_id: str) -> None:
        await self._collection.delete_many({"user_id": user_id})


def _user_from_doc(doc: dict) -> User:
    return User(
        user_id=str(doc["_id"]),
        username=str(doc.get("username", "")),
        role=str(doc.get("role", "user")),
        is_active=bool(doc.get("is_active", True)),
        yjb_token=str(doc.get("yjb_token", "")),
        yjb_nickname=str(doc.get("yjb_nickname", "")),
        yjb_avatar=str(doc.get("yjb_avatar", "")),
        yjb_login_time=str(doc.get("yjb_login_time", "")),
    )
