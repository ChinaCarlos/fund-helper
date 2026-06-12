from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

NotifyChannel = Literal["dingtalk", "feishu", "wecom"]
ConnectivityStatus = Literal["success", "error"]


class WebhookIntegration(BaseModel):
    enabled: bool = False
    url: str = ""
    signingSecret: str = ""


class DingTalkAppIntegration(BaseModel):
    enabled: bool = False
    clientId: str = ""
    clientSecret: str = ""
    agentId: str = ""
    receiveChatIds: list[str] = Field(default_factory=list)
    receiveChatId: str = ""  # 兼容旧配置，读取时合并到 receiveChatIds
    receiveUserId: str = ""


class FeishuAppIntegration(BaseModel):
    enabled: bool = False
    appId: str = ""
    appSecret: str = ""
    encryptKey: str = ""
    verificationToken: str = ""
    receiveChatIds: list[str] = Field(default_factory=list)
    receiveChatId: str = ""  # 兼容旧配置
    receiveOpenId: str = ""


class WecomWebhookIntegration(BaseModel):
    enabled: bool = False
    webhookKey: str = ""
    remark: str = ""


class WecomAppIntegration(BaseModel):
    enabled: bool = False
    corpId: str = ""
    corpSecret: str = ""
    agentId: str = ""
    callbackToken: str = ""
    callbackAesKey: str = ""
    receiveChatIds: list[str] = Field(default_factory=list)
    receiveChatId: str = ""  # 兼容旧配置
    receiveUserId: str = ""


class DingTalkChannel(BaseModel):
    webhook: WebhookIntegration = Field(default_factory=WebhookIntegration)
    app: DingTalkAppIntegration = Field(default_factory=DingTalkAppIntegration)


class FeishuChannel(BaseModel):
    webhook: WebhookIntegration = Field(default_factory=WebhookIntegration)
    app: FeishuAppIntegration = Field(default_factory=FeishuAppIntegration)


class WecomChannel(BaseModel):
    webhook: WecomWebhookIntegration = Field(default_factory=WecomWebhookIntegration)
    app: WecomAppIntegration = Field(default_factory=WecomAppIntegration)


class NotificationChannels(BaseModel):
    dingtalk: DingTalkChannel = Field(default_factory=DingTalkChannel)
    feishu: FeishuChannel = Field(default_factory=FeishuChannel)
    wecom: WecomChannel = Field(default_factory=WecomChannel)


class TriggerConfig(BaseModel):
    frequency: str = "manual"
    tradingHoursOnly: bool = True


class NotificationConfig(BaseModel):
    version: int = 1
    enabled: bool = False
    trigger: TriggerConfig = Field(default_factory=TriggerConfig)
    channels: NotificationChannels = Field(default_factory=NotificationChannels)


class NotifyTestBody(BaseModel):
    channel: NotifyChannel
    config: NotificationConfig


class ConnectivityTestResponse(BaseModel):
    status: ConnectivityStatus
    message: str
    details: list[str] = Field(default_factory=list)


PushStatus = Literal["success", "partial", "error", "skipped"]
PushChannelStatus = Literal["success", "error"]


class NotifyConfigBody(BaseModel):
    config: NotificationConfig


class NotifyConfigResponse(BaseModel):
    config: NotificationConfig | None = None


class DeliveryChatOptionModel(BaseModel):
    id: str
    name: str
    kind: str = "group"


class DeliveryTargetsBody(BaseModel):
    config: NotificationConfig


class DeliveryTargetsResponse(BaseModel):
    status: ConnectivityStatus
    message: str
    chats: list[DeliveryChatOptionModel] = Field(default_factory=list)


class FeishuCreateGroupBody(BaseModel):
    config: NotificationConfig
    mobile: str = ""
    groupName: str = "华尔街之狼"


class FeishuCreateGroupResponse(BaseModel):
    status: ConnectivityStatus
    message: str
    chatId: str = ""
    chatName: str = ""
    reused: bool = False


class PushChannelResult(BaseModel):
    channel: NotifyChannel
    status: PushChannelStatus
    message: str


class PushResponse(BaseModel):
    status: PushStatus
    message: str
    results: list[PushChannelResult] = Field(default_factory=list)
