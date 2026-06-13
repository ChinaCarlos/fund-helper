from __future__ import annotations

from fastapi import Response

from app.config import settings


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_id,
        max_age=settings.session_max_age_days * 86400,
        httponly=True,
        samesite="lax",
        path="/",
        secure=settings.session_cookie_secure,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
    )
