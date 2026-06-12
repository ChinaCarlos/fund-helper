from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any

import httpx

HTTP_TIMEOUT = 20.0
DEFAULT_GROUP_NAME = "华尔街之狼"
MOBILE_LOOKUP_SCOPE = "contact:user.id:readonly"
CHAT_CREATE_SCOPE = "im:chat:create"


@dataclass
class FeishuGroupCreateResult:
    chat_id: str
    name: str
    reused: bool = False


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


def _permission_auth_url(app_id: str, scope: str) -> str:
    return (
        f"https://open.feishu.cn/app/{app_id}/auth"
        f"?q={scope}&op_from=openapi&token_type=tenant"
    )


def _normalize_mobile(value: str) -> str:
    return re.sub(r"\s+", "", _trim(value))


def _group_uuid(app_id: str, open_id: str, group_name: str) -> str:
    digest = hashlib.sha256(
        f"yjb-notify:{app_id}:{open_id}:{group_name}".encode()
    ).hexdigest()
    return digest[:50]


def _permission_denied_message(data: Any, *, app_id: str, scope: str, label: str) -> str | None:
    if not isinstance(data, dict):
        return None
    raw = _parse_error(data, "")
    violations = ((data.get("error") or {}).get("permission_violations")) or []
    scopes = {item.get("subject") for item in violations if isinstance(item, dict)}
    if data.get("code") == 99991672 or scope in raw or scope in scopes:
        return f"请先开通「{label}」权限并发布应用：{_permission_auth_url(app_id, scope)}"
    return None


async def _tenant_token(
    client: httpx.AsyncClient,
    *,
    app_id: str,
    app_secret: str,
) -> tuple[bool, str, str]:
    response = await client.post(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        json={"app_id": app_id, "app_secret": app_secret},
    )
    data = response.json()
    if response.status_code >= 400 or not _is_ok(data):
        return False, _parse_error(data, "获取飞书 token 失败"), ""
    token = (data.get("data") or {}).get("tenant_access_token") or data.get("tenant_access_token")
    if not token:
        return False, "飞书 token 响应为空", ""
    return True, "ok", str(token)


async def _resolve_open_id_by_mobile(
    client: httpx.AsyncClient,
    *,
    token: str,
    app_id: str,
    mobile: str,
) -> tuple[bool, str, str]:
    response = await client.post(
        "https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id",
        params={"user_id_type": "open_id"},
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"mobiles": [mobile]},
    )
    data = response.json()
    if response.status_code >= 400 or not _is_ok(data):
        denied = _permission_denied_message(
            data,
            app_id=app_id,
            scope=MOBILE_LOOKUP_SCOPE,
            label="通过手机号或邮箱获取用户 ID",
        )
        if denied:
            return False, denied, ""
        return False, _parse_error(data, "通过手机号查询用户失败"), ""

    for item in (data.get("data") or {}).get("user_list") or []:
        if not isinstance(item, dict):
            continue
        open_id = _trim(item.get("user_id"))
        if open_id.startswith("ou_"):
            return True, "ok", open_id

    return (
        False,
        "未找到该手机号对应的飞书用户，请确认号码已在企业通讯录登记，且应用在通讯录权限范围内",
        "",
    )


async def _find_group_by_name(
    client: httpx.AsyncClient,
    *,
    token: str,
    name: str,
) -> str:
    page_token = ""
    while True:
        params: dict[str, Any] = {"page_size": 50}
        if page_token:
            params["page_token"] = page_token
        response = await client.get(
            "https://open.feishu.cn/open-apis/im/v1/chats",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
        if response.status_code >= 400 or not _is_ok(data):
            return ""
        body = data.get("data") or {}
        for item in body.get("items") or []:
            if _trim(item.get("name")) == name:
                return _trim(item.get("chat_id"))
        if not body.get("has_more"):
            break
        page_token = _trim(body.get("page_token"))
        if not page_token:
            break
    return ""


async def _update_group_name(
    client: httpx.AsyncClient,
    *,
    token: str,
    chat_id: str,
    name: str,
) -> tuple[bool, str]:
    response = await client.put(
        f"https://open.feishu.cn/open-apis/im/v1/chats/{chat_id}",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"name": name},
    )
    data = response.json()
    if response.status_code < 400 and _is_ok(data):
        return True, name
    return False, _parse_error(data, "更新群名称失败")


async def create_feishu_notification_group(
    *,
    app_id: str,
    app_secret: str,
    mobile: str,
    group_name: str = DEFAULT_GROUP_NAME,
) -> tuple[bool, str, FeishuGroupCreateResult | None]:
    app_id = _trim(app_id)
    app_secret = _trim(app_secret)
    mobile = _normalize_mobile(mobile)
    group_name = _trim(group_name) or DEFAULT_GROUP_NAME

    if not app_id or not app_secret:
        return False, "请先填写飞书 App ID 与 App Secret", None
    if not mobile:
        return False, "请填写手机号", None
    if not re.fullmatch(r"1\d{10}", mobile):
        return False, "请输入 11 位中国大陆手机号", None

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        ok, detail, token = await _tenant_token(client, app_id=app_id, app_secret=app_secret)
        if not ok:
            return False, detail, None

        ok, detail, open_id = await _resolve_open_id_by_mobile(
            client,
            token=token,
            app_id=app_id,
            mobile=mobile,
        )
        if not ok:
            return False, detail, None

        uuid = _group_uuid(app_id, open_id, group_name)

        response = await client.post(
            "https://open.feishu.cn/open-apis/im/v1/chats",
            params={
                "user_id_type": "open_id",
                "uuid": uuid,
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "name": group_name,
                "owner_id": open_id,
                "user_id_list": [open_id],
                "chat_type": "private",
                "join_message_visibility": "not_anyone",
                "leave_message_visibility": "not_anyone",
            },
        )
        data = response.json()
        if response.status_code < 400 and _is_ok(data):
            body = data.get("data") or {}
            chat_id = _trim(body.get("chat_id"))
            if chat_id:
                returned_name = _trim(body.get("name")) or group_name
                reused = returned_name != group_name
                final_name = returned_name
                message = "专属通知群已就绪"
                if reused:
                    updated, updated_name = await _update_group_name(
                        client,
                        token=token,
                        chat_id=chat_id,
                        name=group_name,
                    )
                    if updated:
                        final_name = updated_name
                        message = "已复用现有通知群并更新群名称"
                    else:
                        message = (
                            f"10 小时内已创建过通知群，当前名称仍为「{returned_name}」；"
                            f"如需新名称请稍后再试或手动改名"
                        )
                return (
                    True,
                    message,
                    FeishuGroupCreateResult(
                        chat_id=chat_id,
                        name=final_name,
                        reused=reused,
                    ),
                )

        denied = _permission_denied_message(
            data,
            app_id=app_id,
            scope=CHAT_CREATE_SCOPE,
            label="创建群",
        )
        if denied:
            return False, denied, None

        existing_id = await _find_group_by_name(client, token=token, name=group_name)
        if existing_id:
            return (
                True,
                "10 小时内已创建过通知群，已复用现有群组",
                FeishuGroupCreateResult(chat_id=existing_id, name=group_name, reused=True),
            )

        return (
            False,
            _parse_error(
                data,
                f"创建通知群失败，请确认已开通「创建群」权限：{_permission_auth_url(app_id, CHAT_CREATE_SCOPE)}",
            ),
            None,
        )
