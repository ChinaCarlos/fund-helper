from __future__ import annotations

import base64
import io
from collections.abc import Awaitable, Callable
from typing import Any, Optional

import httpx
import qrcode
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from qrcode.constants import ERROR_CORRECT_H

from app.yjb.auth_store import normalize_avatar_url
from app.yjb.calculator import normalize_income_line, normalize_income_lines
from app.yjb.client import YjbApiError, YjbClient

router = APIRouter(prefix="/api")


class AddFundItemBody(BaseModel):
    fund_id: int
    fund_code: str
    hold_share: str
    hold_cost: str
    model: int = 1


class AddFundBody(BaseModel):
    account_id: int
    items: list[AddFundItemBody] = Field(min_length=1)


async def _with_yjb_client(
    request: Request,
    fn: Callable[[YjbClient], Awaitable[Any]],
) -> Any:
    session = request.app.state.auth_store.session
    if not session.is_valid:
        raise HTTPException(status_code=401, detail="未登录")

    client = YjbClient(token=session.token)
    try:
        return await fn(client)
    except YjbApiError as exc:
        if exc.status_code == 401:
            request.app.state.auth_store.clear()
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        await client.close()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/auth/status")
async def auth_status(request: Request) -> dict:
    session = request.app.state.auth_store.session
    return {
        "logged_in": session.is_valid,
        "nickname": session.nickname,
        "avatar": session.avatar,
        "login_time": session.login_time,
    }


@router.get("/auth/avatar")
async def get_avatar(request: Request) -> Response:
    """代理养基宝用户头像，避免前端直连 CDN 加载失败。"""
    session = request.app.state.auth_store.session
    if not session.is_valid or not session.avatar:
        raise HTTPException(status_code=404, detail="无头像")

    url = normalize_avatar_url(session.avatar)
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(
                url,
                headers={"Referer": "https://yangjibao.com/"},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="头像加载失败") from exc

    media_type = response.headers.get("content-type", "image/jpeg")
    return Response(
        content=response.content,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.post("/auth/logout")
async def logout(request: Request) -> dict:
    request.app.state.auth_store.clear()
    return {"ok": True}


@router.post("/auth/qrcode")
async def create_qrcode(request: Request) -> dict:
    client = YjbClient()
    try:
        data = await client.get_qrcode()
    finally:
        await client.close()

    url = data["url"]
    qr_id = data["id"]

    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode()

    request.app.state.qr_sessions[qr_id] = url
    return {"id": qr_id, "url": url, "image_base64": image_base64}


@router.get("/auth/qrcode/{qr_id}/status")
async def qrcode_status(qr_id: str, request: Request) -> dict:
    client = YjbClient()
    try:
        data = await client.get_qrcode_state(qr_id)
    finally:
        await client.close()

    state = str(data.get("state", ""))
    if state == "2" and data.get("token"):
        request.app.state.auth_store.save(
            token=data["token"],
            nickname=data.get("nickname", ""),
            avatar=normalize_avatar_url(data.get("avatar", "")),
        )

    return {
        "state": state,
        "nickname": data.get("nickname"),
        "avatar": data.get("avatar"),
    }


@router.get("/portfolio")
async def get_portfolio(request: Request) -> dict:
    session = request.app.state.auth_store.session
    if not session.is_valid:
        raise HTTPException(status_code=401, detail="未登录")

    try:
        return await request.app.state.poller.fetch_snapshot()
    except YjbApiError as exc:
        if exc.status_code == 401:
            request.app.state.auth_store.clear()
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/accounts")
async def get_accounts(request: Request) -> dict:
    return await _with_yjb_client(request, lambda c: c.get_accounts())


@router.get("/income/line")
async def get_income_line(
    request: Request,
    account_id: Optional[int] = None,
    account_ids: list[int] = Query(default=[], alias="account_ids[]"),
    collect: bool = Query(False),
) -> dict:
    ids = list(account_ids)
    if not ids and account_id is not None:
        ids = [account_id]
    use_collect = collect or not ids
    target_id = None if use_collect else ids[0]

    async def fetch(client: YjbClient) -> dict:
        raw = await client.get_income_line_data(
            account_ids=None if use_collect else ids,
            collect=use_collect,
        )
        return normalize_income_line(raw, account_id=target_id)

    return await _with_yjb_client(request, fetch)


@router.get("/income/lines")
async def get_income_lines(
    request: Request,
    account_ids: list[int] = Query(alias="account_ids[]"),
) -> dict:
    if not account_ids:
        raise HTTPException(status_code=400, detail="account_ids 不能为空")

    async def fetch(client: YjbClient) -> dict:
        raw = await client.get_income_line_data(account_ids=account_ids)
        return normalize_income_lines(raw, account_ids=account_ids)

    return await _with_yjb_client(request, fetch)


@router.get("/funds/search")
async def search_funds(
    request: Request,
    keyword: str = Query(min_length=1),
    account_id: Optional[int] = None,
) -> list:
    return await _with_yjb_client(
        request,
        lambda c: c.search_fund(keyword, account_id=account_id),
    )


@router.post("/funds/hold")
async def add_fund_hold(body: AddFundBody, request: Request) -> dict:
    items = [
        {
            "fund_id": item.fund_id,
            "fund_code": item.fund_code,
            "hold_share": item.hold_share,
            "hold_cost": item.hold_cost,
            "model": item.model,
        }
        for item in body.items
    ]
    data = await _with_yjb_client(
        request,
        lambda c: c.add_fund_hold(account_id=body.account_id, items=items),
    )
    return {"ok": True, "data": data}


@router.delete("/funds/hold")
async def remove_fund_hold(
    request: Request,
    account_id: int = Query(),
    fund_ids: list[int] = Query(alias="fund_ids[]"),
) -> dict:
    if not fund_ids:
        raise HTTPException(status_code=400, detail="fund_ids 不能为空")

    data = await _with_yjb_client(
        request,
        lambda c: c.remove_fund_hold(account_id=account_id, fund_ids=fund_ids),
    )
    return {"ok": True, "data": data}
