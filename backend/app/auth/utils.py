from __future__ import annotations


def normalize_avatar_url(url: str) -> str:
    value = (url or "").strip()
    if value.startswith("http://"):
        return f"https://{value[7:]}"
    return value
