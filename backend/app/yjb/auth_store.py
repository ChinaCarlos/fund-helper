from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from app.config import settings


def normalize_avatar_url(url: str) -> str:
    value = (url or "").strip()
    if value.startswith("http://"):
        return f"https://{value[7:]}"
    return value


@dataclass
class AuthSession:
    token: str
    nickname: str = ""
    avatar: str = ""
    login_time: str = ""

    @property
    def is_valid(self) -> bool:
        return bool(self.token)


class AuthStore:
    def __init__(self, path: Path | None = None):
        self.path = path or settings.data_dir / "token.json"
        self._session = AuthSession(token="")
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            self._try_migrate_legacy_token()
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self._session = AuthSession(
                token=data.get("token", ""),
                nickname=data.get("nickname", ""),
                avatar=normalize_avatar_url(data.get("avatar", "")),
                login_time=data.get("login_time", ""),
            )
        except (json.JSONDecodeError, OSError):
            self._session = AuthSession(token="")

    def _try_migrate_legacy_token(self) -> None:
        project_root = Path(__file__).resolve().parents[3]
        legacy_candidates = [
            project_root.parent / "yjb-plugin-1.1.4" / "scripts" / "token.json",
            project_root / "yjb-plugin-1.1.4" / "scripts" / "token.json",
        ]
        legacy = next((p for p in legacy_candidates if p.exists()), None)
        if not legacy:
            return
        if legacy.exists():
            try:
                data = json.loads(legacy.read_text(encoding="utf-8"))
                if data.get("token"):
                    self.save(
                        token=data["token"],
                        nickname=data.get("nickname", ""),
                        avatar=data.get("avatar", ""),
                    )
            except (json.JSONDecodeError, OSError):
                pass

    @property
    def session(self) -> AuthSession:
        return self._session

    def save(self, *, token: str, nickname: str = "", avatar: str = "") -> AuthSession:
        avatar = normalize_avatar_url(avatar)
        self._session = AuthSession(
            token=token,
            nickname=nickname,
            avatar=avatar,
            login_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )
        self.path.write_text(
            json.dumps(
                {
                    "token": token,
                    "nickname": nickname,
                    "avatar": avatar,
                    "login_time": self._session.login_time,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return self._session

    def clear(self) -> None:
        self._session = AuthSession(token="")
        if self.path.exists():
            self.path.unlink()
