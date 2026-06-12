from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.notify.schemas import DingTalkAppIntegration, FeishuAppIntegration, WecomAppIntegration

ReceiveIdType = Literal["chat_id", "open_id", "user_id"]


@dataclass
class AppDeliveryTarget:
    receive_id: str
    receive_id_type: ReceiveIdType
    label: str


def _trim(value: str | None) -> str:
    return (value or "").strip()


def _normalize_chat_ids(raw: list[str] | None, legacy: str | None = None) -> list[str]:
    ids: list[str] = []
    for item in raw or []:
        value = _trim(item)
        if value and value not in ids:
            ids.append(value)
    legacy_value = _trim(legacy)
    if legacy_value and legacy_value not in ids:
        ids.insert(0, legacy_value)
    return ids


def list_feishu_chat_targets(app: FeishuAppIntegration) -> list[AppDeliveryTarget]:
    chat_ids = _normalize_chat_ids(app.receiveChatIds, app.receiveChatId)
    return [
        AppDeliveryTarget(receive_id=chat_id, receive_id_type="chat_id", label="会话")
        for chat_id in chat_ids
    ]


def list_dingtalk_chat_targets(app: DingTalkAppIntegration) -> list[AppDeliveryTarget]:
    chat_ids = _normalize_chat_ids(app.receiveChatIds, app.receiveChatId)
    return [
        AppDeliveryTarget(receive_id=chat_id, receive_id_type="chat_id", label="会话")
        for chat_id in chat_ids
    ]


def list_wecom_chat_targets(app: WecomAppIntegration) -> list[AppDeliveryTarget]:
    chat_ids = _normalize_chat_ids(app.receiveChatIds, app.receiveChatId)
    return [
        AppDeliveryTarget(receive_id=chat_id, receive_id_type="chat_id", label="会话")
        for chat_id in chat_ids
    ]


def resolve_feishu_app_deliveries(app: FeishuAppIntegration) -> list[AppDeliveryTarget]:
    return list_feishu_chat_targets(app)


def resolve_dingtalk_app_deliveries(app: DingTalkAppIntegration) -> list[AppDeliveryTarget]:
    targets = list_dingtalk_chat_targets(app)
    user_id = _trim(app.receiveUserId)
    if user_id:
        targets.append(
            AppDeliveryTarget(receive_id=user_id, receive_id_type="user_id", label="用户")
        )
    return targets


def resolve_wecom_app_deliveries(app: WecomAppIntegration) -> list[AppDeliveryTarget]:
    targets = list_wecom_chat_targets(app)
    user_id = _trim(app.receiveUserId)
    if user_id:
        targets.append(
            AppDeliveryTarget(receive_id=user_id, receive_id_type="user_id", label="用户")
        )
    return targets


def has_feishu_app_delivery(app: FeishuAppIntegration) -> bool:
    return bool(resolve_feishu_app_deliveries(app))


def has_dingtalk_app_delivery(app: DingTalkAppIntegration) -> bool:
    return bool(resolve_dingtalk_app_deliveries(app))


def has_wecom_app_delivery(app: WecomAppIntegration) -> bool:
    return bool(resolve_wecom_app_deliveries(app))
