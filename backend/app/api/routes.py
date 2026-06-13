from __future__ import annotations

import base64
import io
from collections.abc import Awaitable, Callable
from typing import Any, Optional

import httpx
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from qrcode.constants import ERROR_CORRECT_H

from app.auth.cookies import clear_session_cookie, set_session_cookie
from app.auth.deps import get_current_user, get_optional_user, invalidate_session
from app.auth.models import User
from app.auth.repository import SessionRepository, UserRepository
from app.auth.utils import normalize_avatar_url
from app.market.benchmark_curve import get_curve_overlays
from app.market.fund_curve import get_fund_curve, get_fund_curve_options
from app.market.fund_rank import get_fund_rank, get_fund_rank_options
from app.market.heatmap import get_heatmap, get_heatmap_options
from app.market.sector_funds import get_sector_funds
from app.market.schemas import (
    CurveOverlaysResponse,
    FundCurveIndicator,
    FundCurveOptionsResponse,
    FundCurvePeriod,
    FundCurveResponse,
    FundFlowIndicator,
    FundRankOptionsResponse,
    FundRankResponse,
    HeatmapBoardType,
    HeatmapKind,
    HeatmapOptionsResponse,
    HeatmapResponse,
    RankDimension,
    RankScope,
    SectorFundsResponse,
)
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
from app.services.poller import PortfolioPoller
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


class LoginBody(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class ChangePasswordBody(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=64)


def _poller(request: Request) -> PortfolioPoller:
    return request.app.state.poller


def _user_repo(request: Request) -> UserRepository:
    return request.app.state.user_repo


def _session_repo(request: Request) -> SessionRepository:
    return request.app.state.session_repo


async def _with_yjb_client(
    request: Request,
    user: User,
    fn: Callable[[YjbClient], Awaitable[Any]],
) -> Any:
    if not user.has_yjb:
        raise HTTPException(status_code=403, detail="yjb_not_bound")

    client = YjbClient(token=user.yjb_token)
    try:
        return await fn(client)
    except YjbApiError as exc:
        if exc.status_code == 401:
            await _user_repo(request).clear_yjb(user.user_id)
            raise HTTPException(status_code=401, detail="yjb_token_expired") from exc
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        await client.close()


async def _fetch_snapshot(request: Request, user: User) -> dict:
    try:
        return await _poller(request).fetch_snapshot(user)
    except YjbApiError as exc:
        if exc.status_code in {401, 403}:
            await _user_repo(request).clear_yjb(user.user_id)
            raise HTTPException(
                status_code=401 if exc.status_code == 401 else 403,
                detail="yjb_token_expired" if exc.status_code == 401 else "yjb_not_bound",
            ) from exc
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/health")
async def health(request: Request) -> dict:
    try:
        db = request.app.state.db
        await db.command("ping")
        return {"status": "ok", "mongodb": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"MongoDB unavailable: {exc}") from exc


@router.get("/auth/status")
async def auth_status(user: User | None = Depends(get_optional_user)) -> dict:
    if user is None:
        return {
            "logged_in": False,
            "username": "",
            "role": "",
            "user_id": None,
            "yjb_bound": False,
            "yjb_nickname": "",
            "yjb_avatar": "",
            "yjb_login_time": "",
        }
    return {
        "logged_in": True,
        "username": user.username,
        "role": user.role,
        "user_id": user.user_id,
        "yjb_bound": user.has_yjb,
        "yjb_nickname": user.yjb_nickname,
        "yjb_avatar": user.yjb_avatar,
        "yjb_login_time": user.yjb_login_time,
    }


@router.post("/auth/login")
async def login(request: Request, body: LoginBody) -> JSONResponse:
    user = await _user_repo(request).authenticate(body.username.strip(), body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    session = await _session_repo(request).create(user.user_id)
    response = JSONResponse(
        {
            "ok": True,
            "username": user.username,
            "role": user.role,
            "user_id": user.user_id,
        }
    )
    set_session_cookie(response, session.session_id)
    return response


@router.get("/auth/avatar")
async def get_avatar(user: User = Depends(get_current_user)) -> Response:
    """代理养基宝用户头像，避免前端直连 CDN 加载失败。"""
    if not user.has_yjb or not user.yjb_avatar:
        raise HTTPException(status_code=404, detail="无头像")

    url = normalize_avatar_url(user.yjb_avatar)
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
async def logout(request: Request) -> JSONResponse:
    await invalidate_session(request)
    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    return response


@router.put("/auth/password")
async def change_password(
    request: Request,
    body: ChangePasswordBody,
    user: User = Depends(get_current_user),
) -> dict:
    try:
        await _user_repo(request).change_password(
            user.user_id,
            current_password=body.current_password,
            new_password=body.new_password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.post("/auth/yjb/qrcode")
async def create_yjb_qrcode(
    request: Request,
    user: User = Depends(get_current_user),
) -> dict:
    _ = user
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


@router.get("/auth/yjb/qrcode/{qr_id}/status")
async def yjb_qrcode_status(
    qr_id: str,
    request: Request,
    user: User = Depends(get_current_user),
) -> dict:
    client = YjbClient()
    try:
        data = await client.get_qrcode_state(qr_id)
    finally:
        await client.close()

    state = str(data.get("state", ""))
    payload = {
        "state": state,
        "nickname": data.get("nickname"),
        "avatar": data.get("avatar"),
    }

    if state == "2" and data.get("token"):
        bound = await _user_repo(request).bind_yjb(
            user.user_id,
            token=data["token"],
            nickname=data.get("nickname", ""),
            avatar=normalize_avatar_url(data.get("avatar", "")),
        )
        payload["yjb_nickname"] = bound.yjb_nickname
        payload["yjb_bound"] = True

    return payload


@router.delete("/auth/yjb/unbind")
async def unbind_yjb(request: Request, user: User = Depends(get_current_user)) -> dict:
    _ = user
    await _user_repo(request).clear_yjb(user.user_id)
    return {"ok": True}


@router.get("/portfolio")
async def get_portfolio(
    request: Request,
    user: User = Depends(get_current_user),
) -> dict:
    if not user.has_yjb:
        raise HTTPException(status_code=403, detail="yjb_not_bound")
    return await _fetch_snapshot(request, user)


@router.get("/accounts")
async def get_accounts(
    request: Request,
    user: User = Depends(get_current_user),
) -> dict:
    return await _with_yjb_client(request, user, lambda c: c.get_accounts())


@router.get("/income/line")
async def get_income_line(
    request: Request,
    user: User = Depends(get_current_user),
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

    return await _with_yjb_client(request, user, fetch)


@router.get("/income/lines")
async def get_income_lines(
    request: Request,
    user: User = Depends(get_current_user),
    account_ids: list[int] = Query(alias="account_ids[]"),
) -> dict:
    if not account_ids:
        raise HTTPException(status_code=400, detail="account_ids 不能为空")

    async def fetch(client: YjbClient) -> dict:
        raw = await client.get_income_line_data(account_ids=account_ids)
        return normalize_income_lines(raw, account_ids=account_ids)

    return await _with_yjb_client(request, user, fetch)


@router.get("/funds/search")
async def search_funds(
    request: Request,
    user: User = Depends(get_current_user),
    keyword: str = Query(min_length=1),
    account_id: Optional[int] = None,
) -> list:
    return await _with_yjb_client(
        request,
        user,
        lambda c: c.search_fund(keyword, account_id=account_id),
    )


@router.post("/funds/hold")
async def add_fund_hold(
    body: AddFundBody,
    request: Request,
    user: User = Depends(get_current_user),
) -> dict:
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
        user,
        lambda c: c.add_fund_hold(account_id=body.account_id, items=items),
    )
    return {"ok": True, "data": data}


@router.delete("/funds/hold")
async def remove_fund_hold(
    request: Request,
    user: User = Depends(get_current_user),
    account_id: int = Query(),
    fund_ids: list[int] = Query(alias="fund_ids[]"),
) -> dict:
    if not fund_ids:
        raise HTTPException(status_code=400, detail="fund_ids 不能为空")

    data = await _with_yjb_client(
        request,
        user,
        lambda c: c.remove_fund_hold(account_id=account_id, fund_ids=fund_ids),
    )
    return {"ok": True, "data": data}


@router.get("/notify/config", response_model=NotifyConfigResponse)
async def notify_config_get(
    request: Request,
    user: User = Depends(get_current_user),
) -> NotifyConfigResponse:
    config = await request.app.state.notify_config_store.load(user.user_id)
    return NotifyConfigResponse(config=config)


@router.put("/notify/config", response_model=NotifyConfigResponse)
async def notify_config_put(
    request: Request,
    body: NotifyConfigBody,
    user: User = Depends(get_current_user),
) -> NotifyConfigResponse:
    saved = await request.app.state.notify_config_store.save(user.user_id, body.config)
    return NotifyConfigResponse(config=saved)


@router.post("/notify/feishu/create-notification-group", response_model=FeishuCreateGroupResponse)
async def notify_feishu_create_group(
    request: Request,
    body: FeishuCreateGroupBody,
    user: User = Depends(get_current_user),
) -> FeishuCreateGroupResponse:
    _ = user
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
    user: User = Depends(get_current_user),
) -> DeliveryTargetsResponse:
    _ = user
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
async def notify_test(
    request: Request,
    body: NotifyTestBody,
    user: User = Depends(get_current_user),
) -> ConnectivityTestResponse:
    snapshot: dict | None = None
    try:
        snapshot = await _fetch_snapshot(request, user)
    except HTTPException:
        snapshot = None

    return await test_channel_connectivity(body.channel, body.config, snapshot=snapshot)


@router.post("/notify/push", response_model=PushResponse)
async def notify_push(
    request: Request,
    user: User = Depends(get_current_user),
) -> PushResponse:
    config = await request.app.state.notify_config_store.load(user.user_id)
    if config is None:
        return PushResponse(status="skipped", message="未配置通知，请先在设置中保存", results=[])

    snapshot = await _fetch_snapshot(request, user)
    return await push_portfolio_notification(config, snapshot)


@router.get("/market/rank/options", response_model=FundRankOptionsResponse)
async def market_rank_options(user: User = Depends(get_current_user)) -> FundRankOptionsResponse:
    _ = user
    return await get_fund_rank_options()


@router.get("/market/rank", response_model=FundRankResponse)
async def market_rank(
    user: User = Depends(get_current_user),
    dimension: RankDimension = Query("day"),
    scope: RankScope = Query("open"),
    fund_type: str = Query("全部"),
    board: str = Query("全部"),
    sector: str = Query(""),
    search: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    order: str = Query("desc", pattern="^(asc|desc)$"),
) -> FundRankResponse:
    _ = user
    try:
        return await get_fund_rank(
            dimension=dimension,
            scope=scope,
            fund_type=fund_type,
            board=board,
            sector=sector,
            search=search,
            page=page,
            page_size=page_size,
            order=order,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"拉取市场排行失败：{exc}") from exc


@router.get("/market/heatmap/options", response_model=HeatmapOptionsResponse)
async def market_heatmap_options(user: User = Depends(get_current_user)) -> HeatmapOptionsResponse:
    _ = user
    return await get_heatmap_options()


@router.get("/market/heatmap", response_model=HeatmapResponse)
async def market_heatmap(
    user: User = Depends(get_current_user),
    kind: HeatmapKind = Query("sector_change"),
    board_type: HeatmapBoardType = Query("industry"),
    indicator: FundFlowIndicator = Query("今日"),
) -> HeatmapResponse:
    _ = user
    try:
        return await get_heatmap(kind=kind, board_type=board_type, indicator=indicator)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"拉取板块热力图失败：{exc}") from exc


@router.get("/market/fund/{code}/curve/options", response_model=FundCurveOptionsResponse)
async def market_fund_curve_options(
    code: str,
    user: User = Depends(get_current_user),
) -> FundCurveOptionsResponse:
    _ = user
    return await get_fund_curve_options(code)


@router.get("/market/fund/{code}/curve", response_model=FundCurveResponse)
async def market_fund_curve(
    code: str,
    user: User = Depends(get_current_user),
    indicator: FundCurveIndicator = Query("累计收益率走势"),
    period: FundCurvePeriod = Query("1年"),
    name: str = Query(""),
) -> FundCurveResponse:
    _ = user
    try:
        return await get_fund_curve(code, indicator=indicator, period=period, name=name)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"拉取基金曲线失败：{exc}") from exc


@router.get("/market/sector/funds", response_model=SectorFundsResponse)
async def market_sector_funds(
    user: User = Depends(get_current_user),
    sector: str = Query(..., min_length=1),
    board_type: HeatmapBoardType = Query("industry"),
    limit: int = Query(50, ge=1, le=100),
) -> SectorFundsResponse:
    _ = user
    try:
        return await get_sector_funds(sector=sector, board_type=board_type, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"拉取板块基金失败：{exc}") from exc


@router.get("/market/curve/overlays", response_model=CurveOverlaysResponse)
async def market_curve_overlays(
    user: User = Depends(get_current_user),
    period: FundCurvePeriod = Query("1年"),
    sector_name: str = Query(""),
    board_type: HeatmapBoardType = Query("industry"),
) -> CurveOverlaysResponse:
    _ = user
    try:
        return await get_curve_overlays(
            period=period,
            sector_name=sector_name,
            board_type=board_type,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"拉取对比曲线失败：{exc}") from exc
