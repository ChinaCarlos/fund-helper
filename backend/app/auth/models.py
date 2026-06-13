from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class User:
    user_id: str
    username: str
    role: str
    is_active: bool
    yjb_token: str
    yjb_nickname: str
    yjb_avatar: str
    yjb_login_time: str

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def has_yjb(self) -> bool:
        return bool(self.yjb_token)


@dataclass
class Session:
    session_id: str
    user_id: str
    expires_at: datetime

    @property
    def is_expired(self) -> bool:
        from datetime import UTC

        now = datetime.now(UTC)
        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        return now >= expires_at
