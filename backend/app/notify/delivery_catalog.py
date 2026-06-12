from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.notify.schemas import (
    DingTalkChannel,
    FeishuChannel,
    NotificationConfig,
    NotifyChannel,
    WecomChannel,
)

HTTP_TIMEOUT = 20.0
MAX_CHATS = 100


@dataclass
class DeliveryChatOption:
    id: str
    name: str
    kind: str = "group"


def _trim(value: str | None) -> str:
    return (value or "").strip()


def _is_ok(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    code = data.get("code", data.get("errcode"))
    return code in (0, "0", None)


def _parse_error(data: Any, fallback: str) -> str:
    if isinstance(data, dict):
        for key in ("msg", "message", "errmsg"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return fallback


async def _feishu_tenant_token(
    client: httpx.AsyncClient,
    *,
    app_id: str,
    app_secret: str,
) -> tuple[bool, str, str]:
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    response = await client.post(url, json={"app_id": app_id, "app_secret": app_secret})
    data = response.json()
    if response.status_code >= 400 or not _is_ok(data):
        return False, _parse_error(data, "获取飞书 token 失败"), ""
    token = (data.get("data") or {}).get("tenant_access_token") or data.get("tenant_access_token")
    if not token:
        return False, "飞书 token 响应为空", ""
    return True, "ok", str(token)


async def _list_feishu_chats(
    client: httpx.AsyncClient,
    *,
    app_id: str,
    app_secret: str,
) -> tuple[list[DeliveryChatOption], str]:
    ok, detail, token = await _feishu_tenant_token(client, app_id=app_id, app_secret=app_secret)
    if not ok:
        return [], detail

    groups: list[DeliveryChatOption] = []
    page_token = ""
    while len(groups) < MAX_CHATS:
        params: dict[str, Any] = {"page_size": min(50, MAX_CHATS - len(groups))}
        if page_token:
            params["page_token"] = page_token
        response = await client.get(
            "https://open.feishu.cn/open-apis/im/v1/chats",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
        if response.status_code >= 400 or not _is_ok(data):
            if groups:
                break
            return [], _parse_error(data, "拉取飞书群列表失败，请确认应用已加入目标群并开通 im:chat 权限")

        body = data.get("data") or {}
        for item in body.get("items") or []:
            chat_id = _trim(item.get("chat_id"))
            if not chat_id:
                continue
            name = _trim(item.get("name")) or chat_id
            groups.append(DeliveryChatOption(id=chat_id, name=name, kind="group"))
        if not body.get("has_more"):
            break
        page_token = _trim(body.get("page_token"))
        if not page_token:
            break

    if groups:
        return groups, f"已加载 {len(groups)} 个群；也可点击「创建专属通知群」新建两人通知群"
    return (
        [],
        "未找到机器人所在的群，可点击「创建专属通知群」新建，或先把机器人拉入目标群后刷新",
    )


async def _dingtalk_access_token(
    client: httpx.AsyncClient,
    *,
    client_id: str,
    client_secret: str,
) -> tuple[bool, str, str]:
    response = await client.get(
        "https://oapi.dingtalk.com/gettoken",
        params={"appkey": client_id, "appsecret": client_secret},
    )
    data = response.json()
    if response.status_code >= 400 or not _is_ok(data):
        return False, _parse_error(data, "获取钉钉 token 失败"), ""
    token = data.get("access_token")
    if not token:
        return False, "钉钉 token 响应为空", ""
    return True, "ok", str(token)


async def _list_dingtalk_chats(
    client: httpx.AsyncClient,
    *,
    client_id: str,
    client_secret: str,
) -> tuple[list[DeliveryChatOption], str]:
    ok, detail, token = await _dingtalk_access_token(
        client,
        client_id=client_id,
        client_secret=client_secret,
    )
    if not ok:
        return [], detail

    # 新版 OpenAPI：查询机器人/应用可见场景群（需应用具备相应权限）
    response = await client.post(
        "https://api.dingtalk.com/v1.0/im/sceneGroups/query",
        headers={
            "x-acs-dingtalk-access-token": token,
            "Content-Type": "application/json",
        },
        json={"maxResults": MAX_CHATS},
    )
    data = response.json()
    if response.status_code >= 400:
        return [], _parse_error(data, "拉取钉钉会话失败，请确认应用权限或先在目标群添加机器人")

    groups = data.get("result") or data.get("groups") or data.get("items") or []
    if not isinstance(groups, list):
        groups = []

    chats: list[DeliveryChatOption] = []
    for item in groups:
        if not isinstance(item, dict):
            continue
        chat_id = _trim(
            item.get("openConversationId")
            or item.get("conversationId")
            or item.get("chatId")
            or item.get("cid")
        )
        if not chat_id:
            continue
        name = _trim(item.get("title") or item.get("name") or item.get("groupName")) or chat_id
        chats.append(DeliveryChatOption(id=chat_id, name=name, kind="group"))

    if not chats:
        return [], "未找到钉钉会话，请先把机器人加入目标群并开通 IM 相关权限后刷新"
    return chats, f"已加载 {len(chats)} 个钉钉会话"


async def _wecom_access_token(
    client: httpx.AsyncClient,
    *,
    corp_id: str,
    corp_secret: str,
) -> tuple[bool, str, str]:
    response = await client.get(
        "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
        params={"corpid": corp_id, "corpsecret": corp_secret},
    )
    data = response.json()
    if response.status_code >= 400 or not _is_ok(data):
        return False, _parse_error(data, "获取企业微信 token 失败"), ""
    token = data.get("access_token")
    if not token:
        return False, "企业微信 token 响应为空", ""
    return True, "ok", str(token)


async def _list_wecom_chats(
    client: httpx.AsyncClient,
    *,
    corp_id: str,
    corp_secret: str,
) -> tuple[list[DeliveryChatOption], str]:
    ok, detail, token = await _wecom_access_token(
        client,
        corp_id=corp_id,
        corp_secret=corp_secret,
    )
    if not ok:
        return [], detail

    # 客户群列表（内部群无统一 list API，有权限时可拉客户群）
    response = await client.post(
        f"https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/list?access_token={token}",
        json={"limit": min(MAX_CHATS, 100)},
    )
    data = response.json()
    if response.status_code >= 400 or not _is_ok(data):
        return [], _parse_error(
            data,
            "拉取企业微信会话失败；内部群请优先用 Webhook，或在高级选项手填 chatid",
        )

    chats: list[DeliveryChatOption] = []
    for item in (data.get("group_chat_list") or []):
        if not isinstance(item, dict):
            continue
        chat_id = _trim(item.get("chat_id"))
        if not chat_id:
            continue
        name = _trim(item.get("name")) or chat_id
        chats.append(DeliveryChatOption(id=chat_id, name=name, kind="group"))

    if not chats:
        return [], "未找到可推送的客户群；内部应用群请用 Webhook 或高级选项手填 chatid"
    return chats, f"已加载 {len(chats)} 个企业微信会话"


async def list_delivery_chats(
    channel: NotifyChannel,
    config: NotificationConfig,
) -> tuple[list[DeliveryChatOption], str, str]:
    """返回 (会话列表, 提示信息, status success|error)。"""
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        if channel == "feishu":
            app = config.channels.feishu.app
            if not _trim(app.appId) or not _trim(app.appSecret):
                return [], "请先填写飞书 App ID 与 App Secret", "error"
            chats, msg = await _list_feishu_chats(
                client,
                app_id=_trim(app.appId),
                app_secret=_trim(app.appSecret),
            )
            return chats, msg, "success" if chats else "error"

        if channel == "dingtalk":
            app = config.channels.dingtalk.app
            if not _trim(app.clientId) or not _trim(app.clientSecret):
                return [], "请先填写钉钉 Client ID 与 Client Secret", "error"
            chats, msg = await _list_dingtalk_chats(
                client,
                client_id=_trim(app.clientId),
                client_secret=_trim(app.clientSecret),
            )
            return chats, msg, "success" if chats else "error"

        app = config.channels.wecom.app
        if not _trim(app.corpId) or not _trim(app.corpSecret):
            return [], "请先填写企业微信 Corp ID 与 Corp Secret", "error"
        chats, msg = await _list_wecom_chats(
            client,
            corp_id=_trim(app.corpId),
            corp_secret=_trim(app.corpSecret),
        )
        return chats, msg, "success" if chats else "error"
