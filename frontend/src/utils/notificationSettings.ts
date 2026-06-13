/**
 * 通知配置数据结构 v1
 *
 * NotificationConfig
 * ├── version          固定为 1，便于后续演进
 * ├── enabled          总开关
 * ├── trigger          触发策略（频次、交易时段）
 * └── channels         各平台接入
 *     └── {dingtalk|feishu|wecom}
 *         ├── webhook  群机器人，单向推送
 *         └── app      企业应用，可双向交互
 *
 * 通知配置仅存服务端（MongoDB notification_configs）；登录后拉取到内存缓存。
 */

export const NOTIFICATION_CONFIG_VERSION = 1 as const;

/** 已废弃：旧版虚拟单聊投递 ID，保存时自动剔除。 */
export const FEISHU_BOT_P2P_TARGET_ID = '__feishu:bot_p2p';

export type NotifyChannel = 'dingtalk' | 'feishu' | 'wecom';
export type IntegrationKind = 'webhook' | 'app';

export type NotifyFrequency =
  | 'manual'
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '60m'
  | 'daily_close';

export const NOTIFY_FREQUENCY_OPTIONS: { value: NotifyFrequency; label: string }[] = [
  { value: 'manual', label: '仅手动刷新后' },
  { value: '1m', label: '每 1 分钟' },
  { value: '5m', label: '每 5 分钟' },
  { value: '15m', label: '每 15 分钟' },
  { value: '30m', label: '每 30 分钟' },
  { value: '60m', label: '每 60 分钟' },
  { value: 'daily_close', label: '每日收盘汇总' },
];

const NOTIFY_FREQUENCY_INTERVAL_MS: Partial<Record<NotifyFrequency, number>> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '60m': 3_600_000,
};

/** 定时推送间隔（毫秒）；manual / daily_close 返回 null */
export function getNotifyIntervalMs(frequency: NotifyFrequency): number | null {
  return NOTIFY_FREQUENCY_INTERVAL_MS[frequency] ?? null;
}

export const NOTIFICATION_CONFIG_CHANGED_EVENT = 'fund-helper-notification-config-changed';

export type NotifyContentType =
  | 'portfolio'
  | 'fund_gain_top20'
  | 'fund_loss_top20'
  | 'fund_est_gain_top20'
  | 'fund_est_loss_top20'
  | 'sector_change_top10'
  | 'sector_flow_top10';

export const ALL_NOTIFY_CONTENT_TYPES: NotifyContentType[] = [
  'portfolio',
  'fund_gain_top20',
  'fund_loss_top20',
  'fund_est_gain_top20',
  'fund_est_loss_top20',
  'sector_change_top10',
  'sector_flow_top10',
];

export const DEFAULT_NOTIFY_CONTENT_TYPES: NotifyContentType[] = ['portfolio'];

export const NOTIFY_CONTENT_TYPE_OPTIONS: {
  value: NotifyContentType;
  label: string;
  description: string;
  requiresYjb?: boolean;
}[] = [
  {
    value: 'portfolio',
    label: '持仓盈亏',
    description: '推送当前持仓总资产、当日收益、涨跌分布及分组明细（需绑定养基宝）',
    requiresYjb: true,
  },
  {
    value: 'fund_gain_top20',
    label: '涨幅榜 Top20',
    description: '全市场开放式基金当日公布涨幅前 20 名',
  },
  {
    value: 'fund_loss_top20',
    label: '跌幅榜 Top20',
    description: '全市场开放式基金当日公布跌幅前 20 名',
  },
  {
    value: 'fund_est_gain_top20',
    label: '预估涨幅 Top20',
    description: '交易时段盘中实时估算涨幅前 20 名（含估值净值）',
  },
  {
    value: 'fund_est_loss_top20',
    label: '预估跌幅 Top20',
    description: '交易时段盘中实时估算跌幅前 20 名（含估值净值）',
  },
  {
    value: 'sector_change_top10',
    label: '板块涨跌 Top10',
    description: '行业与概念板块当日涨幅前 10、跌幅前 10',
  },
  {
    value: 'sector_flow_top10',
    label: '板块资金 Top10',
    description: '行业与概念板块当日主力净流入前 10、净流出前 10',
  },
];

export interface TriggerConfig {
  frequency: NotifyFrequency;
  tradingHoursOnly: boolean;
  contentTypes: NotifyContentType[];
}

/** 钉钉 / 飞书群机器人 */
export interface WebhookIntegration {
  enabled: boolean;
  url: string;
  signingSecret: string;
}

export interface DingTalkAppIntegration {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  agentId: string;
  receiveChatIds: string[];
  receiveChatId?: string;
  receiveUserId: string;
}

export interface FeishuAppIntegration {
  enabled: boolean;
  appId: string;
  appSecret: string;
  encryptKey: string;
  verificationToken: string;
  receiveChatIds: string[];
  receiveChatId?: string;
  receiveOpenId: string;
}

/** 企业微信群机器人：Webhook URL 中的 key 参数 */
export interface WecomWebhookIntegration {
  enabled: boolean;
  webhookKey: string;
  remark: string;
}

export interface WecomAppIntegration {
  enabled: boolean;
  corpId: string;
  corpSecret: string;
  agentId: string;
  callbackToken: string;
  callbackAesKey: string;
  receiveChatIds: string[];
  receiveChatId?: string;
  receiveUserId: string;
}

export interface DingTalkChannel {
  webhook: WebhookIntegration;
  app: DingTalkAppIntegration;
}

export interface FeishuChannel {
  webhook: WebhookIntegration;
  app: FeishuAppIntegration;
}

export interface WecomChannel {
  webhook: WecomWebhookIntegration;
  app: WecomAppIntegration;
}

export interface NotificationChannels {
  dingtalk: DingTalkChannel;
  feishu: FeishuChannel;
  wecom: WecomChannel;
}

export interface NotificationConfig {
  version: typeof NOTIFICATION_CONFIG_VERSION;
  enabled: boolean;
  trigger: TriggerConfig;
  channels: NotificationChannels;
}

const WEBHOOK_URL_PATTERNS: Record<'dingtalk' | 'feishu', RegExp> = {
  dingtalk: /^https:\/\/oapi\.dingtalk\.com\/robot\/send/i,
  feishu: /^https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\//i,
};

const CHANNEL_LABELS: Record<NotifyChannel, string> = {
  dingtalk: '钉钉',
  feishu: '飞书',
  wecom: '企业微信',
};

function emptyWebhook(): WebhookIntegration {
  return { enabled: false, url: '', signingSecret: '' };
}

function emptyWecomWebhook(): WecomWebhookIntegration {
  return { enabled: false, webhookKey: '', remark: '' };
}

function emptyDingTalkApp(): DingTalkAppIntegration {
  return {
    enabled: false,
    clientId: '',
    clientSecret: '',
    agentId: '',
    receiveChatIds: [],
    receiveUserId: '',
  };
}

function emptyFeishuApp(): FeishuAppIntegration {
  return {
    enabled: false,
    appId: '',
    appSecret: '',
    encryptKey: '',
    verificationToken: '',
    receiveChatIds: [],
    receiveOpenId: '',
  };
}

function emptyWecomApp(): WecomAppIntegration {
  return {
    enabled: false,
    corpId: '',
    corpSecret: '',
    agentId: '',
    callbackToken: '',
    callbackAesKey: '',
    receiveChatIds: [],
    receiveUserId: '',
  };
}

function normalizeChatIds(rawIds: unknown, legacyId?: unknown): string[] {
  const ids: string[] = [];
  if (Array.isArray(rawIds)) {
    for (const item of rawIds) {
      const value = trim(item);
      if (value && !ids.includes(value)) ids.push(value);
    }
  }
  const legacy = trim(legacyId);
  if (legacy && !ids.includes(legacy)) ids.unshift(legacy);
  return ids;
}

function hasAppDeliveryTarget(
  channel: 'dingtalk' | 'feishu' | 'wecom',
  app: DingTalkAppIntegration | FeishuAppIntegration | WecomAppIntegration,
): boolean {
  const chatIds = normalizeChatIds(app.receiveChatIds, app.receiveChatId).filter(
    (id) => id !== FEISHU_BOT_P2P_TARGET_ID,
  );
  if (chatIds.length > 0) return true;
  if (channel === 'feishu') return false;
  return Boolean(trim((app as DingTalkAppIntegration | WecomAppIntegration).receiveUserId));
}

export function createDefaultNotificationConfig(): NotificationConfig {
  return {
    version: NOTIFICATION_CONFIG_VERSION,
    enabled: false,
    trigger: {
      frequency: 'manual',
      tradingHoursOnly: true,
      contentTypes: [...DEFAULT_NOTIFY_CONTENT_TYPES],
    },
    channels: {
      dingtalk: { webhook: emptyWebhook(), app: emptyDingTalkApp() },
      feishu: { webhook: emptyWebhook(), app: emptyFeishuApp() },
      wecom: { webhook: emptyWecomWebhook(), app: emptyWecomApp() },
    },
  };
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mergeWebhook(
  base: WebhookIntegration,
  raw?: Partial<WebhookIntegration>,
): WebhookIntegration {
  if (!raw || typeof raw !== 'object') return { ...base };
  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : base.enabled,
    url: raw.url !== undefined ? trim(raw.url) : base.url,
    signingSecret:
      raw.signingSecret !== undefined ? trim(raw.signingSecret) : base.signingSecret,
  };
}

function mergeWecomWebhook(
  base: WecomWebhookIntegration,
  raw?: Partial<WecomWebhookIntegration>,
): WecomWebhookIntegration {
  if (!raw || typeof raw !== 'object') return { ...base };
  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : base.enabled,
    webhookKey: raw.webhookKey !== undefined ? trim(raw.webhookKey) : base.webhookKey,
    remark: raw.remark !== undefined ? trim(raw.remark) : base.remark,
  };
}

function mergeDingTalkApp(
  base: DingTalkAppIntegration,
  raw?: Partial<DingTalkAppIntegration>,
): DingTalkAppIntegration {
  if (!raw || typeof raw !== 'object') return { ...base };
  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : base.enabled,
    clientId: raw.clientId !== undefined ? trim(raw.clientId) : base.clientId,
    clientSecret:
      raw.clientSecret !== undefined ? trim(raw.clientSecret) : base.clientSecret,
    agentId: raw.agentId !== undefined ? trim(raw.agentId) : base.agentId,
    receiveChatIds: normalizeChatIds(raw.receiveChatIds, raw.receiveChatId ?? base.receiveChatId),
    receiveUserId:
      raw.receiveUserId !== undefined ? trim(raw.receiveUserId) : base.receiveUserId,
  };
}

function mergeFeishuApp(
  base: FeishuAppIntegration,
  raw?: Partial<FeishuAppIntegration>,
): FeishuAppIntegration {
  if (!raw || typeof raw !== 'object') return { ...base };
  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : base.enabled,
    appId: raw.appId !== undefined ? trim(raw.appId) : base.appId,
    appSecret: raw.appSecret !== undefined ? trim(raw.appSecret) : base.appSecret,
    encryptKey: raw.encryptKey !== undefined ? trim(raw.encryptKey) : base.encryptKey,
    verificationToken:
      raw.verificationToken !== undefined
        ? trim(raw.verificationToken)
        : base.verificationToken,
    receiveChatIds: normalizeChatIds(raw.receiveChatIds, raw.receiveChatId ?? base.receiveChatId).filter(
      (id) => id !== FEISHU_BOT_P2P_TARGET_ID,
    ),
    receiveOpenId: '',
  };
}

function mergeWecomApp(
  base: WecomAppIntegration,
  raw?: Partial<WecomAppIntegration>,
): WecomAppIntegration {
  if (!raw || typeof raw !== 'object') return { ...base };
  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : base.enabled,
    corpId: raw.corpId !== undefined ? trim(raw.corpId) : base.corpId,
    corpSecret: raw.corpSecret !== undefined ? trim(raw.corpSecret) : base.corpSecret,
    agentId: raw.agentId !== undefined ? trim(raw.agentId) : base.agentId,
    callbackToken:
      raw.callbackToken !== undefined ? trim(raw.callbackToken) : base.callbackToken,
    callbackAesKey:
      raw.callbackAesKey !== undefined ? trim(raw.callbackAesKey) : base.callbackAesKey,
    receiveChatIds: normalizeChatIds(raw.receiveChatIds, raw.receiveChatId ?? base.receiveChatId),
    receiveUserId:
      raw.receiveUserId !== undefined ? trim(raw.receiveUserId) : base.receiveUserId,
  };
}

function normalizeContentTypes(raw: unknown): NotifyContentType[] {
  if (!Array.isArray(raw)) return [...DEFAULT_NOTIFY_CONTENT_TYPES];
  const seen = new Set<NotifyContentType>();
  const result: NotifyContentType[] = [];
  for (const item of raw) {
    if (
      typeof item === 'string' &&
      ALL_NOTIFY_CONTENT_TYPES.includes(item as NotifyContentType) &&
      !seen.has(item as NotifyContentType)
    ) {
      seen.add(item as NotifyContentType);
      result.push(item as NotifyContentType);
    }
  }
  return result.length > 0 ? result : [...DEFAULT_NOTIFY_CONTENT_TYPES];
}

/** 将表单局部快照与默认值合并，避免 useWatch 缺字段导致读取报错 */
export function mergeNotificationConfig(partial: unknown): NotificationConfig {
  const base = createDefaultNotificationConfig();
  if (!partial || typeof partial !== 'object') return base;

  const input = partial as Partial<NotificationConfig>;
  const channels = input.channels;
  const frequency = input.trigger?.frequency;
  const validFrequency = NOTIFY_FREQUENCY_OPTIONS.some((o) => o.value === frequency)
    ? (frequency as NotifyFrequency)
    : base.trigger.frequency;

  return {
    version: NOTIFICATION_CONFIG_VERSION,
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : base.enabled,
    trigger: {
      frequency: validFrequency,
      tradingHoursOnly:
        input.trigger?.tradingHoursOnly !== undefined
          ? input.trigger.tradingHoursOnly !== false
          : base.trigger.tradingHoursOnly,
      contentTypes: normalizeContentTypes(input.trigger?.contentTypes),
    },
    channels: {
      dingtalk: {
        webhook: mergeWebhook(
          base.channels.dingtalk.webhook,
          channels?.dingtalk?.webhook,
        ),
        app: mergeDingTalkApp(base.channels.dingtalk.app, channels?.dingtalk?.app),
      },
      feishu: {
        webhook: mergeWebhook(base.channels.feishu.webhook, channels?.feishu?.webhook),
        app: mergeFeishuApp(base.channels.feishu.app, channels?.feishu?.app),
      },
      wecom: {
        webhook: mergeWecomWebhook(
          base.channels.wecom.webhook,
          channels?.wecom?.webhook,
        ),
        app: mergeWecomApp(base.channels.wecom.app, channels?.wecom?.app),
      },
    },
  };
}

function parseWebhook(raw: unknown): WebhookIntegration {
  if (!raw || typeof raw !== 'object') return emptyWebhook();
  const item = raw as Partial<WebhookIntegration>;
  return {
    enabled: Boolean(item.enabled),
    url: trim(item.url),
    signingSecret: trim(item.signingSecret),
  };
}

function parseWecomWebhook(raw: unknown): WecomWebhookIntegration {
  if (!raw || typeof raw !== 'object') return emptyWecomWebhook();
  const item = raw as Partial<WecomWebhookIntegration>;
  return {
    enabled: Boolean(item.enabled),
    webhookKey: trim(item.webhookKey),
    remark: trim(item.remark),
  };
}

function parseTrigger(raw: unknown): TriggerConfig {
  if (!raw || typeof raw !== 'object') {
    return createDefaultNotificationConfig().trigger;
  }
  const item = raw as Partial<TriggerConfig>;
  const frequency = NOTIFY_FREQUENCY_OPTIONS.some((o) => o.value === item.frequency)
    ? (item.frequency as NotifyFrequency)
    : 'manual';
  return {
    frequency,
    tradingHoursOnly: item.tradingHoursOnly !== false,
    contentTypes: normalizeContentTypes(item.contentTypes),
  };
}

function parseDingTalkChannel(raw: unknown): DingTalkChannel {
  if (!raw || typeof raw !== 'object') {
    return createDefaultNotificationConfig().channels.dingtalk;
  }
  const item = raw as Partial<DingTalkChannel>;
  const appRaw = item.app;
  const app =
    appRaw && typeof appRaw === 'object'
      ? {
          enabled: Boolean(appRaw.enabled),
          clientId: trim(appRaw.clientId),
          clientSecret: trim(appRaw.clientSecret),
          agentId: trim(appRaw.agentId),
          receiveChatIds: normalizeChatIds(appRaw.receiveChatIds, appRaw.receiveChatId),
          receiveUserId: trim(appRaw.receiveUserId),
        }
      : emptyDingTalkApp();
  return { webhook: parseWebhook(item.webhook), app };
}

function parseFeishuChannel(raw: unknown): FeishuChannel {
  if (!raw || typeof raw !== 'object') {
    return createDefaultNotificationConfig().channels.feishu;
  }
  const item = raw as Partial<FeishuChannel>;
  const appRaw = item.app;
  const app =
    appRaw && typeof appRaw === 'object'
      ? {
          enabled: Boolean(appRaw.enabled),
          appId: trim(appRaw.appId),
          appSecret: trim(appRaw.appSecret),
          encryptKey: trim(appRaw.encryptKey),
          verificationToken: trim(appRaw.verificationToken),
          receiveChatIds: normalizeChatIds(appRaw.receiveChatIds, appRaw.receiveChatId).filter(
            (id) => id !== FEISHU_BOT_P2P_TARGET_ID,
          ),
          receiveOpenId: '',
        }
      : emptyFeishuApp();
  return { webhook: parseWebhook(item.webhook), app };
}

function parseWecomChannel(raw: unknown): WecomChannel {
  if (!raw || typeof raw !== 'object') {
    return createDefaultNotificationConfig().channels.wecom;
  }
  const item = raw as Partial<WecomChannel>;
  const appRaw = item.app;
  const app =
    appRaw && typeof appRaw === 'object'
      ? {
          enabled: Boolean(appRaw.enabled),
          corpId: trim(appRaw.corpId),
          corpSecret: trim(appRaw.corpSecret),
          agentId: trim(appRaw.agentId),
          callbackToken: trim(appRaw.callbackToken),
          callbackAesKey: trim(appRaw.callbackAesKey),
          receiveChatIds: normalizeChatIds(appRaw.receiveChatIds, appRaw.receiveChatId),
          receiveUserId: trim(appRaw.receiveUserId),
        }
      : emptyWecomApp();
  return { webhook: parseWecomWebhook(item.webhook), app };
}

function parseChannels(raw: unknown): NotificationChannels {
  const defaults = createDefaultNotificationConfig().channels;
  if (!raw || typeof raw !== 'object') return defaults;
  const item = raw as Partial<NotificationChannels>;
  return {
    dingtalk: parseDingTalkChannel(item.dingtalk),
    feishu: parseFeishuChannel(item.feishu),
    wecom: parseWecomChannel(item.wecom),
  };
}

export function parseNotificationConfig(raw: unknown): NotificationConfig {
  if (!raw || typeof raw !== 'object') {
    return createDefaultNotificationConfig();
  }
  const item = raw as Partial<NotificationConfig>;
  if (item.version !== NOTIFICATION_CONFIG_VERSION || !item.channels) {
    return createDefaultNotificationConfig();
  }
  return {
    version: NOTIFICATION_CONFIG_VERSION,
    enabled: Boolean(item.enabled),
    trigger: parseTrigger(item.trigger),
    channels: parseChannels(item.channels),
  };
}

export function sanitizeNotificationConfig(
  input: Partial<NotificationConfig>,
): NotificationConfig {
  return mergeNotificationConfig(input);
}

export function getChannel(
  config: NotificationConfig,
  channel: NotifyChannel,
): DingTalkChannel | FeishuChannel | WecomChannel {
  return mergeNotificationConfig(config).channels[channel];
}

export function isChannelActive(channel: NotifyChannel, config: NotificationConfig): boolean {
  const cfg = mergeNotificationConfig(config).channels[channel];
  return Boolean(cfg.webhook?.enabled) || Boolean(cfg.app?.enabled);
}

export function isChannelConfigured(
  channel: NotifyChannel,
  config: NotificationConfig,
): boolean {
  const cfg = mergeNotificationConfig(config).channels[channel];
  if (channel === 'wecom') {
    const wecom = cfg as WecomChannel;
    const webhookOk = wecom.webhook.enabled && Boolean(trim(wecom.webhook.webhookKey));
    const appOk =
      wecom.app.enabled &&
      Boolean(trim(wecom.app.corpId)) &&
      Boolean(trim(wecom.app.corpSecret)) &&
      Boolean(trim(wecom.app.agentId)) &&
      hasAppDeliveryTarget('wecom', wecom.app);
    return webhookOk || appOk;
  }
  if (channel === 'dingtalk') {
    const dt = cfg as DingTalkChannel;
    const webhookOk = dt.webhook.enabled && Boolean(trim(dt.webhook.url));
    const appOk =
      dt.app.enabled &&
      Boolean(trim(dt.app.clientId)) &&
      Boolean(trim(dt.app.clientSecret)) &&
      hasAppDeliveryTarget('dingtalk', dt.app);
    return webhookOk || appOk;
  }
  const fs = cfg as FeishuChannel;
  const webhookOk = fs.webhook.enabled && Boolean(trim(fs.webhook.url));
  const appOk =
    fs.app.enabled &&
    Boolean(trim(fs.app.appId)) &&
    Boolean(trim(fs.app.appSecret)) &&
    hasAppDeliveryTarget('feishu', fs.app);
  return webhookOk || appOk;
}

function validateWebhook(
  channel: 'dingtalk' | 'feishu',
  webhook: WebhookIntegration,
): string | null {
  if (!webhook.enabled) return null;
  const url = webhook.url.trim();
  if (!url) return `请填写${CHANNEL_LABELS[channel]}群机器人 Webhook`;
  if (!url.startsWith('https://')) return 'Webhook 地址需以 https:// 开头';
  if (!WEBHOOK_URL_PATTERNS[channel].test(url)) {
    return `${CHANNEL_LABELS[channel]} Webhook 地址格式不正确`;
  }
  return null;
}

export function validateNotificationSettings(config: NotificationConfig): string | null {
  const merged = mergeNotificationConfig(config);
  if (!merged.enabled) return null;

  if (!merged.trigger.contentTypes.length) {
    return '请至少选择一种消息类型';
  }

  const channelKeys: NotifyChannel[] = ['dingtalk', 'feishu', 'wecom'];
  if (!channelKeys.some((key) => isChannelActive(key, merged))) {
    return '请至少启用一个通知渠道（群机器人或应用）';
  }

  const dt = merged.channels.dingtalk;
  const dtWebhookErr = validateWebhook('dingtalk', dt.webhook);
  if (dtWebhookErr) return dtWebhookErr;
  if (dt.app.enabled) {
    if (!trim(dt.app.clientId)) return '请填写钉钉 Client ID';
    if (!trim(dt.app.clientSecret)) return '请填写钉钉 Client Secret';
    if (!hasAppDeliveryTarget('dingtalk', dt.app)) {
      return '请选择钉钉投递会话或填写用户 ID';
    }
  }

  const fs = merged.channels.feishu;
  const fsWebhookErr = validateWebhook('feishu', fs.webhook);
  if (fsWebhookErr) return fsWebhookErr;
  if (fs.app.enabled) {
    if (!trim(fs.app.appId)) return '请填写飞书 App ID';
    if (!trim(fs.app.appSecret)) return '请填写飞书 App Secret';
    if (!hasAppDeliveryTarget('feishu', fs.app)) {
      return '请选择飞书投递会话，或点击「创建专属通知群」';
    }
  }

  const wc = merged.channels.wecom;
  if (wc.webhook.enabled && !trim(wc.webhook.webhookKey)) {
    return '请填写企业微信群机器人 Webhook Key';
  }
  if (wc.app.enabled) {
    if (!trim(wc.app.corpId)) return '请填写企业微信 Corp ID';
    if (!trim(wc.app.corpSecret)) return '请填写企业微信 Corp Secret';
    if (!trim(wc.app.agentId)) return '请填写企业微信 Agent ID';
    if (!hasAppDeliveryTarget('wecom', wc.app)) {
      return '请选择企业微信投递会话或填写用户 ID';
    }
  }

  return null;
}
