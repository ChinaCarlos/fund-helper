from __future__ import annotations

import json
from pathlib import Path

from app.config import settings
from app.notify.schemas import NotificationConfig


class NotificationConfigStore:
    """通知配置持久化到 data/notification-config.json（含各渠道投递目标）。"""

    def __init__(self, path: Path | None = None):
        self.path = path or settings.data_dir / "notification-config.json"

    def load(self) -> NotificationConfig | None:
        if not self.path.exists():
            return None
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            return NotificationConfig.model_validate(raw)
        except (OSError, json.JSONDecodeError, ValueError):
            return None

    def save(self, config: NotificationConfig) -> NotificationConfig:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = config.model_dump()
        self.path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return config

    def clear(self) -> None:
        if self.path.exists():
            self.path.unlink()
