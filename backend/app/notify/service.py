from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import urllib.parse
from typing import Any

import httpx

from app.notify.schemas import (
    ConnectivityTestResponse,
    DingTalkChannel,
    FeishuChannel,
    NotificationConfig,
    NotifyChannel,
    PushChannelResult,
    PushResponse,
    WecomChannel,
    WebhookIntegration,
)
from app.notify.delivery import (
    AppDeliveryTarget,
    has_dingtalk_app_delivery,
    has_feishu_app_delivery,
    has_wecom_app_delivery,
    resolve_dingtalk_app_deliveries,
    resolve_feishu_app_deliveries,
    resolve_wecom_app_deliveries,
)
from app.notify.template import (
    build_connectivity_test_card,
    build_connectivity_test_message,
    build_feishu_im_payload,
    build_feishu_interactive_card,
    build_feishu_webhook_payload,
    build_portfolio_notification,
)

def _feishu_card_for(
    snapshot: dict | None,
    *,
    is_test: bool,
) -> dict[str, Any]:
    if is_test:
        return build_connectivity_test_card(snapshot)
    if snapshot:
        return build_feishu_interactive_card(snapshot)
    return build_connectivity_test_card(None)

CHANNEL_LABELS: dict[NotifyChannel, str] = {
    "dingtalk": "钉钉",
    "feishu": "飞书",
    "wecom": "企业微信",
}

HTTP_TIMEOUT = 15.0


def _trim(value: str | None) -> str:
    return (value or "").strip()


def _error(channel: NotifyChannel, message: str, details: list[str] | None = None) -> ConnectivityTestResponse:
    label = CHANNEL_LABELS[channel]
    return ConnectivityTestResponse(
        status="error",
        message=message if message.startswith(label) else f"{label}{message}",
        details=details or [],
    )


def _success(channel: NotifyChannel, details: list[str]) -> ConnectivityTestResponse:
    return ConnectivityTestResponse(
        status="success",
        message=f"{CHANNEL_LABELS[channel]}连通性测试通过",
        details=details,
    )


def _validate_dingtalk(cfg: DingTalkChannel) -> list[str]:
    issues: list[str] = []
    if not cfg.webhook.enabled and not cfg.app.enabled:
        return ["请至少启用群机器人或应用"]
    if cfg.webhook.enabled:
        url = _trim(cfg.webhook.url)
        if not url:
            issues.append("群机器人：Webhook 未填写")
        elif not url.startswith("https://"):
            issues.append("群机器人：Webhook 需以 https:// 开头")
    if cfg.app.enabled:
        if not _trim(cfg.app.clientId):
            issues.append("应用：Client ID 未填写")
        if not _trim(cfg.app.clientSecret):
            issues.append("应用：Client Secret 未填写")
        if not has_dingtalk_app_delivery(cfg.app):
            issues.append("应用：请选择投递会话（推荐）或填写用户 ID")
    return issues


def _validate_feishu(cfg: FeishuChannel) -> list[str]:
    issues: list[str] = []
    if not cfg.webhook.enabled and not cfg.app.enabled:
        return ["请至少启用群机器人或应用"]
    if cfg.webhook.enabled:
        url = _trim(cfg.webhook.url)
        if not url:
            issues.append("群机器人：Webhook 未填写")
        elif not url.startswith("https://"):
            issues.append("群机器人：Webhook 需以 https:// 开头")
    if cfg.app.enabled:
        if not _trim(cfg.app.appId):
            issues.append("应用：App ID 未填写")
        if not _trim(cfg.app.appSecret):
            issues.append("应用：App Secret 未填写")
        if not has_feishu_app_delivery(cfg.app):
            issues.append("应用：请选择投递会话，或点击「创建专属通知群」")
    return issues


def _validate_wecom(cfg: WecomChannel) -> list[str]:
    issues: list[str] = []
    if not cfg.webhook.enabled and not cfg.app.enabled:
        return ["请至少启用群机器人或应用"]
    if cfg.webhook.enabled and not _trim(cfg.webhook.webhookKey):
        issues.append("群机器人：Webhook Key 未填写")
    if cfg.app.enabled:
        if not _trim(cfg.app.corpId):
            issues.append("应用：Corp ID 未填写")
        if not _trim(cfg.app.corpSecret):
            issues.append("应用：Corp Secret 未填写")
        if not _trim(cfg.app.agentId):
            issues.append("应用：Agent ID 未填写")
        if not has_wecom_app_delivery(cfg.app):
            issues.append("应用：请选择投递会话（推荐）或填写用户 ID")
    return issues


def _dingtalk_sign_url(webhook_url: str, secret: str) -> str:
    timestamp = str(round(time.time() * 1000))
    string_to_sign = f"{timestamp}\n{secret}"
    digest = hmac.new(
        secret.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    sign = urllib.parse.quote_plus(base64.b64encode(digest))
    joiner = "&" if "?" in webhook_url else "?"
    return f"{webhook_url}{joiner}timestamp={timestamp}&sign={sign}"


def _feishu_sign_headers(secret: str) -> dict[str, str]:
    timestamp = str(int(time.time()))
    string_to_sign = f"{timestamp}\n{secret}"
    digest = hmac.new(
        secret.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    sign = base64.b64encode(digest).decode("utf-8")
    return {
        "X-Lark-Request-Timestamp": timestamp,
        "X-Lark-Signature": sign,
    }


def _parse_remote_error(data: Any, fallback: str) -> str:
    if not isinstance(data, dict):
        return fallback
    for key in ("errmsg", "msg", "message", "error_description", "error"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    code = data.get("errcode", data.get("code"))
    if code not in (None, 0, "0"):
        return f"{fallback}（code={code}）"
    return fallback


def _is_remote_ok(data: Any) -> bool:
    if not isinstance(data, dict):
        return False
    if data.get("ok") is True:
        return True
    code = data.get("errcode", data.get("code"))
    if code in (0, "0"):
        return True
    return False


async def _post_json(
    client: httpx.AsyncClient,
    url: str,
    payload: dict[str, Any],
    *,
    headers: dict[str, str] | None = None,
) -> tuple[bool, str, dict[str, Any] | None]:
    try:
        response = await client.post(url, json=payload, headers=headers)
        data: dict[str, Any] | None
        try:
            data = response.json()
        except Exception:
            data = None

        if response.status_code >= 400:
            detail = _parse_remote_error(data, response.text or f"HTTP {response.status_code}")
            return False, detail, data

        if data is not None and not _is_remote_ok(data):
            return False, _parse_remote_error(data, "远程接口返回失败"), data

        return True, "ok", data
    except httpx.TimeoutException:
        return False, "请求超时，请检查网络或 Webhook 地址", None
    except httpx.HTTPError as exc:
        return False, f"网络请求失败：{exc}", None


def _build_channel_content(
    channel: NotifyChannel,
    snapshot: dict | None,
    *,
    is_test: bool = False,
) -> tuple[str, dict[str, Any] | None]:
    if snapshot:
        text = (
            build_connectivity_test_message(snapshot)
            if is_test
            else build_portfolio_notification(snapshot)
        )
        return text, _feishu_card_for(snapshot, is_test=is_test)

    fallback = (
        "【Fund Helper·连通性测试】\n你好，这是 fund-helper system message test"
        if is_test
        else "【Fund Helper】暂无持仓数据"
    )
    feishu_card = _feishu_card_for(None, is_test=is_test) if is_test else None
    return fallback, feishu_card


async def _send_dingtalk_webhook(
    client: httpx.AsyncClient,
    webhook: WebhookIntegration,
    text: str,
) -> tuple[bool, str]:
    url = _trim(webhook.url)
    secret = _trim(webhook.signingSecret)
    if secret:
        url = _dingtalk_sign_url(url, secret)
    payload = {"msgtype": "text", "text": {"content": text}}
    ok, detail, _ = await _post_json(client, url, payload)
    return (True, "群消息卡片已发送") if ok else (False, detail)


async def _send_feishu_webhook_card(
    client: httpx.AsyncClient,
    webhook: WebhookIntegration,
    card: dict[str, Any],
) -> tuple[bool, str]:
    url = _trim(webhook.url)
    secret = _trim(webhook.signingSecret)
    headers = _feishu_sign_headers(secret) if secret else None
    payload = build_feishu_webhook_payload(card)
    ok, detail, _ = await _post_json(client, url, payload, headers=headers)
    return (True, "飞书消息卡片已发送") if ok else (False, detail)


async def _send_wecom_webhook(
    client: httpx.AsyncClient,
    webhook_key: str,
    text: str,
) -> tuple[bool, str]:
    url = f"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={urllib.parse.quote(webhook_key)}"
    payload = {"msgtype": "text", "text": {"content": text}}
    ok, detail, _ = await _post_json(client, url, payload)
    return (True, "群消息已发送") if ok else (False, detail)


async def _feishu_get_tenant_token(client: httpx.AsyncClient, cfg: FeishuChannel) -> tuple[bool, str, str]:
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    payload = {
        "app_id": _trim(cfg.app.appId),
        "app_secret": _trim(cfg.app.appSecret),
    }
    ok, detail, data = await _post_json(client, url, payload)
    if not ok:
        return False, detail, ""
    if not data or not data.get("tenant_access_token"):
        return False, "获取 tenant_access_token 失败：响应无 token", ""
    return True, "tenant_access_token 获取成功", str(data["tenant_access_token"])


async def _feishu_send_im_card(
    client: httpx.AsyncClient,
    token: str,
    *,
    receive_id: str,
    receive_id_type: str,
    card: dict[str, Any],
) -> tuple[bool, str]:
    url = f"https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type={receive_id_type}"
    headers = {"Authorization": f"Bearer {token}"}
    body = build_feishu_im_payload(card)
    payload = {
        "receive_id": receive_id,
        "msg_type": body["msg_type"],
        "content": body["content"],
    }
    ok, detail, _ = await _post_json(client, url, payload, headers=headers)
    short_id = receive_id[:12] + ("…" if len(receive_id) > 12 else "")
    return (True, f"已发送到{receive_id_type}（{short_id}）") if ok else (False, detail)


async def _send_feishu_app(
    client: httpx.AsyncClient,
    cfg: FeishuChannel,
    card: dict[str, Any],
) -> tuple[bool, str]:
    targets = resolve_feishu_app_deliveries(cfg.app)
    if not targets:
        return False, "请选择投递会话或填写 Open ID"

    ok, detail, token = await _feishu_get_tenant_token(client, cfg)
    if not ok:
        return False, detail

    async def send_one(target: AppDeliveryTarget) -> tuple[bool, str]:
        return await _feishu_send_im_card(
            client,
            token,
            receive_id=target.receive_id,
            receive_id_type=target.receive_id_type,
            card=card,
        )

    return await _send_app_targets(client, targets=targets, send_one=send_one)


async def _test_dingtalk_app(client: httpx.AsyncClient, cfg: DingTalkChannel) -> tuple[bool, str]:
    url = "https://oapi.dingtalk.com/gettoken"
    params = {
        "appkey": _trim(cfg.app.clientId),
        "appsecret": _trim(cfg.app.clientSecret),
    }
    try:
        response = await client.get(url, params=params)
        data = response.json()
        if response.status_code >= 400 or not _is_remote_ok(data):
            return False, _parse_remote_error(data, "获取 access_token 失败")
        if not data.get("access_token"):
            return False, "获取 access_token 失败：响应无 token"
        return True, "凭据有效（钉钉应用发消息待接入 AgentId 工作通知）"
    except httpx.TimeoutException:
        return False, "请求超时"
    except httpx.HTTPError as exc:
        return False, f"网络请求失败：{exc}"


async def _send_wecom_to_target(
    client: httpx.AsyncClient,
    *,
    token: str,
    cfg: WecomChannel,
    target: AppDeliveryTarget,
    text: str,
) -> tuple[bool, str]:
    if target.receive_id_type == "chat_id":
        send_url = f"https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token={token}"
        payload = {
            "chatid": target.receive_id,
            "msgtype": "text",
            "text": {"content": text},
            "safe": 0,
        }
    else:
        send_url = f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={token}"
        payload = {
            "touser": target.receive_id,
            "msgtype": "text",
            "agentid": int(_trim(cfg.app.agentId)),
            "text": {"content": text},
            "safe": 0,
        }
    ok, detail, _ = await _post_json(client, send_url, payload)
    short_id = target.receive_id[:12] + ("…" if len(target.receive_id) > 12 else "")
    return (True, f"{target.label} {short_id} 投递成功") if ok else (False, detail)


async def _send_app_targets(
    client: httpx.AsyncClient,
    *,
    targets: list[AppDeliveryTarget],
    send_one,
) -> tuple[bool, str]:
    successes: list[str] = []
    failures: list[str] = []
    for target in targets:
        ok, msg = await send_one(target)
        if ok:
            successes.append(msg)
        else:
            failures.append(f"{target.label}：{msg}")
    if successes and not failures:
        return True, f"已投递 {len(successes)} 个目标"
    if successes:
        return True, f"部分成功（{len(successes)}/{len(targets)}）：" + "；".join(failures)
    return False, "；".join(failures) if failures else "投递失败"


async def _send_wecom_app(
    client: httpx.AsyncClient,
    cfg: WecomChannel,
    text: str,
) -> tuple[bool, str]:
    targets = resolve_wecom_app_deliveries(cfg.app)
    if not targets:
        return False, "请选择投递会话或填写用户 ID"

    url = "https://qyapi.weixin.qq.com/cgi-bin/gettoken"
    params = {
        "corpid": _trim(cfg.app.corpId),
        "corpsecret": _trim(cfg.app.corpSecret),
    }
    try:
        response = await client.get(url, params=params)
        data = response.json()
        if response.status_code >= 400 or not _is_remote_ok(data):
            return False, _parse_remote_error(data, "获取 access_token 失败")
        token = data.get("access_token")
        if not token:
            return False, "获取 access_token 失败：响应无 token"

        successes: list[str] = []
        failures: list[str] = []
        for target in targets:
            ok, msg = await _send_wecom_to_target(
                client,
                token=str(token),
                cfg=cfg,
                target=target,
                text=text,
            )
            if ok:
                successes.append(msg)
            else:
                failures.append(f"{target.label}：{msg}")
        if successes and not failures:
            return True, f"已投递 {len(successes)} 个目标"
        if successes:
            return True, f"部分成功（{len(successes)}/{len(targets)}）：" + "；".join(failures)
        return False, "；".join(failures) if failures else "投递失败"
    except ValueError:
        return False, "Agent ID 格式不正确"
    except httpx.TimeoutException:
        return False, "请求超时"
    except httpx.HTTPError as exc:
        return False, f"网络请求失败：{exc}"


def _is_channel_active(cfg: DingTalkChannel | FeishuChannel | WecomChannel) -> bool:
    return bool(cfg.webhook.enabled) or bool(cfg.app.enabled)


async def _send_channel_message(
    channel: NotifyChannel,
    cfg: DingTalkChannel | FeishuChannel | WecomChannel,
    snapshot: dict | None,
    *,
    is_test: bool = False,
) -> list[tuple[str, bool, str]]:
    results: list[tuple[str, bool, str]] = []
    text, feishu_card = _build_channel_content(channel, snapshot, is_test=is_test)

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
        if channel in ("dingtalk", "feishu"):
            typed = cfg  # type: ignore
            if typed.webhook.enabled:
                if channel == "dingtalk":
                    ok, msg = await _send_dingtalk_webhook(client, typed.webhook, text)
                elif feishu_card:
                    ok, msg = await _send_feishu_webhook_card(client, typed.webhook, feishu_card)
                else:
                    ok, msg = False, "无法构建飞书消息卡片"
                results.append(("群机器人", ok, msg))
            if typed.app.enabled:
                if channel == "dingtalk":
                    ok, msg = await _test_dingtalk_app(client, typed)
                elif feishu_card:
                    ok, msg = await _send_feishu_app(client, typed, feishu_card)
                else:
                    ok, msg = False, "无法构建飞书消息卡片"
                results.append(("应用", ok, msg))
        else:
            wecom = cfg  # type: ignore[assignment]
            if wecom.webhook.enabled:
                ok, msg = await _send_wecom_webhook(
                    client,
                    _trim(wecom.webhook.webhookKey),
                    text,
                )
                results.append(("群机器人", ok, msg))
            if wecom.app.enabled:
                ok, msg = await _send_wecom_app(client, wecom, text)
                results.append(("应用", ok, msg))

    return results


async def _test_channel_modes(
    channel: NotifyChannel,
    cfg: DingTalkChannel | FeishuChannel | WecomChannel,
    snapshot: dict | None,
) -> ConnectivityTestResponse:
    details: list[str] = []
    failures: list[str] = []

    for mode, ok, msg in await _send_channel_message(
        channel,
        cfg,
        snapshot,
        is_test=True,
    ):
        line = f"{mode}：{msg}"
        if ok:
            details.append(line)
        else:
            failures.append(line)

    if failures:
        return _error(channel, "连通性测试未通过", failures + details)

    return _success(channel, details)


async def test_channel_connectivity(
    channel: NotifyChannel,
    config: NotificationConfig,
    *,
    snapshot: dict | None = None,
) -> ConnectivityTestResponse:
    if not config.enabled:
        return _error(channel, "请先开启「启用消息通知」")

    if channel == "dingtalk":
        cfg = config.channels.dingtalk
        issues = _validate_dingtalk(cfg)
    elif channel == "feishu":
        cfg = config.channels.feishu
        issues = _validate_feishu(cfg)
    else:
        cfg = config.channels.wecom
        issues = _validate_wecom(cfg)

    if issues:
        return _error(channel, "配置未通过校验", issues)

    try:
        return await _test_channel_modes(channel, cfg, snapshot)
    except Exception as exc:
        return _error(channel, "连通性测试异常", [str(exc)])


def _should_push_now(config: NotificationConfig, *, trading: bool) -> str | None:
    if not config.enabled:
        return "通知未启用"
    if config.trigger.tradingHoursOnly and not trading:
        return "非交易时段，已跳过推送"
    return None


async def push_portfolio_notification(
    config: NotificationConfig,
    snapshot: dict,
) -> PushResponse:
    skip_reason = _should_push_now(config, trading=bool(snapshot.get("trading")))
    if skip_reason:
        return PushResponse(status="skipped", message=skip_reason, results=[])

    channels: list[NotifyChannel] = ["dingtalk", "feishu", "wecom"]
    results: list[PushChannelResult] = []
    success_count = 0
    active_count = 0

    for channel in channels:
        if channel == "dingtalk":
            cfg = config.channels.dingtalk
            issues = _validate_dingtalk(cfg)
        elif channel == "feishu":
            cfg = config.channels.feishu
            issues = _validate_feishu(cfg)
        else:
            cfg = config.channels.wecom
            issues = _validate_wecom(cfg)

        if not _is_channel_active(cfg):
            continue

        active_count += 1
        if issues:
            results.append(
                PushChannelResult(channel=channel, status="error", message="；".join(issues))
            )
            continue

        try:
            mode_results = await _send_channel_message(channel, cfg, snapshot)
        except Exception as exc:
            results.append(
                PushChannelResult(channel=channel, status="error", message=str(exc))
            )
            continue

        failures = [f"{mode}：{msg}" for mode, ok, msg in mode_results if not ok]
        if failures:
            results.append(
                PushChannelResult(channel=channel, status="error", message="；".join(failures))
            )
            continue

        success_count += 1
        summary = "；".join(f"{mode}：{msg}" for mode, _, msg in mode_results)
        results.append(PushChannelResult(channel=channel, status="success", message=summary))

    if active_count == 0:
        return PushResponse(status="skipped", message="没有启用的通知渠道", results=results)
    if success_count == 0:
        return PushResponse(status="error", message="推送失败", results=results)
    if success_count < active_count:
        return PushResponse(
            status="partial",
            message=f"部分渠道推送成功（{success_count}/{active_count}）",
            results=results,
        )
    return PushResponse(
        status="success",
        message=f"已推送到 {success_count} 个渠道",
        results=results,
    )
