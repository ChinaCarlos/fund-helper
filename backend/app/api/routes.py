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

from app.market.fund_rank import get_fund_rank, get_fund_rank_options
from app.market.schemas import FundRankOptionsResponse, FundRankResponse, RankDimension, RankScope
from app.notify.delivery_catalog import list_delivery_chats
from app.notify.feishu_group import create_feishu_notification_group
from app.notify.schemas import (
    ConnectivityTestResponse,
    DeliveryChatOptionModel,
    DeliveryTargetsBody,
    DeliveryTargetsResponse,
    FeishuCreateGroupBody,
    FeishuCreateGroupResponse,
    NotifyChannel,
    NotifyConfigBody,
    NotifyConfigResponse,
    NotifyTestBody,
    PushResponse,
)
from app.notify.service import push_portfolio_notification, test_channel_connectivity
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


def _require_login(request: Request) -> None:
    session = request.app.state.auth_store.session
    if not session.is_valid:
        raise HTTPException(status_code=401, detail="未登录")


@router.get("/notify/config", response_model=NotifyConfigResponse)
async def notify_config_get(request: Request) -> NotifyConfigResponse:
    """读取服务端持久化的通知配置（含各渠道发送对象）。"""
    _require_login(request)
    config = request.app.state.notify_config_store.load()
    return NotifyConfigResponse(config=config)


@router.put("/notify/config", response_model=NotifyConfigResponse)
async def notify_config_put(request: Request, body: NotifyConfigBody) -> NotifyConfigResponse:
    """保存通知配置到 data/notification-config.json。"""
    _require_login(request)
    saved = request.app.state.notify_config_store.save(body.config)
    return NotifyConfigResponse(config=saved)


@router.post("/notify/feishu/create-notification-group", response_model=FeishuCreateGroupResponse)
async def notify_feishu_create_group(
    request: Request,
    body: FeishuCreateGroupBody,
) -> FeishuCreateGroupResponse:
    """为当前用户创建飞书专属通知群（你 + 机器人），并返回 chat_id。"""
    _require_login(request)
    app = body.config.channels.feishu.app
    ok, message, result = await create_feishu_notification_group(
        app_id=app.appId,
        app_secret=app.appSecret,
        mobile=body.mobile,
        group_name=body.groupName,
    )
    if not ok or result is None:
        raise HTTPException(status_code=400, detail=message)
    return FeishuCreateGroupResponse(
        status="success",
        message=message,
        chatId=result.chat_id,
        chatName=result.name,
        reused=result.reused,
    )


@router.post("/notify/delivery-targets/{channel}", response_model=DeliveryTargetsResponse)
async def notify_delivery_targets(
    channel: NotifyChannel,
    request: Request,
    body: DeliveryTargetsBody,
) -> DeliveryTargetsResponse:
    """根据应用凭据拉取可投递会话列表，供设置页多选。"""
    _require_login(request)
    chats, message, status = await list_delivery_chats(channel, body.config)
    return DeliveryTargetsResponse(
        status=status,  # type: ignore[arg-type]
        message=message,
        chats=[
            DeliveryChatOptionModel(id=item.id, name=item.name, kind=item.kind)
            for item in chats
        ],
    )


@router.post("/notify/test", response_model=ConnectivityTestResponse)
async def notify_test(request: Request, body: NotifyTestBody) -> ConnectivityTestResponse:
    """测试钉钉 / 飞书 / 企业微信通知连通性（发送持仓收益模板消息）。"""
    _require_login(request)

    snapshot: dict | None = None
    try:
        snapshot = await request.app.state.poller.fetch_snapshot()
    except YjbApiError:
        snapshot = None

    return await test_channel_connectivity(body.channel, body.config, snapshot=snapshot)


@router.post("/notify/push", response_model=PushResponse)
async def notify_push(request: Request) -> PushResponse:
    """按模板推送当前持仓收益到已启用的通知渠道（读取 data/ 中的配置）。"""
    _require_login(request)

    config = request.app.state.notify_config_store.load()
    if config is None:
        return PushResponse(status="skipped", message="未配置通知，请先在设置中保存", results=[])

    try:
        snapshot = await request.app.state.poller.fetch_snapshot()
    except YjbApiError as exc:
        if exc.status_code == 401:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return await push_portfolio_notification(config, snapshot)


@router.get("/market/rank/options", response_model=FundRankOptionsResponse)
async def market_rank_options(request: Request) -> FundRankOptionsResponse:
    """市场基金排行筛选项（维度、类型、指数板块、主题板块）。"""
    _require_login(request)
    return await get_fund_rank_options()


@router.get("/market/rank", response_model=FundRankResponse)
async def market_rank(
    request: Request,
    dimension: RankDimension = Query("day"),
    scope: RankScope = Query("open"),
    fund_type: str = Query("全部"),
    board: str = Query("全部"),
    sector: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    order: str = Query("desc", pattern="^(asc|desc)$"),
) -> FundRankResponse:
    """全市场基金排行（AKShare / 东方财富）。"""
    _require_login(request)
    try:
        return await get_fund_rank(
            dimension=dimension,
            scope=scope,
            fund_type=fund_type,
            board=board,
            sector=sector,
            page=page,
            page_size=page_size,
            order=order,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"拉取市场排行失败：{exc}") from exc
