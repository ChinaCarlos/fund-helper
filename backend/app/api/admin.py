from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth.deps import get_current_user, require_admin
from app.auth.repository import UserRepository

router = APIRouter(prefix="/api/admin")


class UserItem(BaseModel):
    user_id: str
    username: str
    role: str
    is_active: bool
    yjb_bound: bool
    yjb_nickname: str
    yjb_login_time: str


class UserListResponse(BaseModel):
    items: list[UserItem]


class CreateUserBody(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=6, max_length=64)


class UpdateUserBody(BaseModel):
    password: str | None = Field(default=None, min_length=6, max_length=64)
    role: Literal["admin", "user"] | None = None
    is_active: bool | None = None


def _user_repo(request: Request) -> UserRepository:
    return request.app.state.user_repo


def _to_item(user) -> UserItem:
    return UserItem(
        user_id=user.user_id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        yjb_bound=user.has_yjb,
        yjb_nickname=user.yjb_nickname,
        yjb_login_time=user.yjb_login_time,
    )


@router.get("/users", response_model=UserListResponse)
async def list_users(request: Request) -> UserListResponse:
    await require_admin(request)
    users = await _user_repo(request).list_users()
    return UserListResponse(items=[_to_item(user) for user in users])


@router.post("/users", response_model=UserItem)
async def create_user(request: Request, body: CreateUserBody) -> UserItem:
    await require_admin(request)
    try:
        user = await _user_repo(request).create_user(
            username=body.username,
            password=body.password,
            role="user",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_item(user)


@router.put("/users/{user_id}", response_model=UserItem)
async def update_user(
    user_id: str,
    request: Request,
    body: UpdateUserBody,
) -> UserItem:
    current = await require_admin(request)
    target = await _user_repo(request).get_by_id(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="用户不存在")

    if target.is_admin:
        if body.role == "user":
            raise HTTPException(status_code=400, detail="不能修改管理员角色")
        if body.is_active is False:
            raise HTTPException(status_code=400, detail="不能禁用管理员账号")
    elif body.role == "admin":
        raise HTTPException(status_code=400, detail="不能提升为管理员")

    if target.user_id == current.user_id and body.is_active is False:
        raise HTTPException(status_code=400, detail="不能禁用当前登录账号")
    if target.user_id == current.user_id and body.role == "user" and current.is_admin:
        raise HTTPException(status_code=400, detail="不能取消自己的管理员权限")

    try:
        user = await _user_repo(request).update_user(
            user_id,
            password=body.password,
            role=body.role,
            is_active=body.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_item(user)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request) -> dict:
    current = await require_admin(request)
    if user_id == current.user_id:
        raise HTTPException(status_code=400, detail="不能删除当前登录账号")

    target = await _user_repo(request).get_by_id(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    if target.is_admin:
        raise HTTPException(status_code=400, detail="不能删除管理员账号")

    await _user_repo(request).delete_user(user_id)
    await request.app.state.session_repo.delete_by_user(user_id)
    await request.app.state.notify_config_store.clear(user_id)
    return {"ok": True}
