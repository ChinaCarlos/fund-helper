from __future__ import annotations

from fastapi import HTTPException, Request

from app.auth.models import User
from app.config import settings


async def get_optional_user(request: Request) -> User | None:
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        return None

    session_repo = request.app.state.session_repo
    user_repo = request.app.state.user_repo

    session = await session_repo.get(session_id)
    if session is None:
        return None

    user = await user_repo.get_by_id(session.user_id)
    if user is None or not user.is_active:
        await session_repo.delete(session_id)
        return None

    await session_repo.touch(session_id)
    return user


async def get_current_user(request: Request) -> User:
    user = await get_optional_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="未登录")
    return user


async def require_admin(request: Request) -> User:
    user = await get_current_user(request)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


async def require_yjb(request: Request) -> User:
    user = await get_current_user(request)
    if not user.has_yjb:
        raise HTTPException(status_code=403, detail="yjb_not_bound")
    return user


async def invalidate_session(request: Request) -> None:
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        return
    await request.app.state.session_repo.delete(session_id)
