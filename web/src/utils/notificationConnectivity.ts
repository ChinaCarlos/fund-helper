import { api } from '@/api/client';
import type {
  DingTalkChannel,
  FeishuChannel,
  NotificationConfig,
  NotifyChannel,
  WecomChannel,
} from '@/utils/notificationSettings';
import { mergeNotificationConfig } from '@/utils/notificationSettings';

export type ConnectivityStatus = 'idle' | 'testing' | 'success' | 'error';

export interface ChannelConnectivityState {
  status: ConnectivityStatus;
  message: string;
  details: string[];
  testedAt: string | null;
}

export interface ConnectivityTestResult {
  status: Exclude<ConnectivityStatus, 'idle' | 'testing'>;
  message: string;
  details: string[];
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

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function createIdleConnectivityState(): ChannelConnectivityState {
  return {
    status: 'idle',
    message: '',
    details: [],
    testedAt: null,
  };
}

export function createInitialConnectivityMap(): Record<NotifyChannel, ChannelConnectivityState> {
  return {
    dingtalk: createIdleConnectivityState(),
    feishu: createIdleConnectivityState(),
    wecom: createIdleConnectivityState(),
  };
}

function checkDingTalk(cfg: DingTalkChannel): string[] {
  const issues: string[] = [];
  if (!cfg.webhook.enabled && !cfg.app.enabled) {
    issues.push('请至少启用群机器人或应用');
    return issues;
  }
  if (cfg.webhook.enabled) {
    const url = trim(cfg.webhook.url);
    if (!url) issues.push('群机器人：Webhook 未填写');
    else if (!url.startsWith('https://')) issues.push('群机器人：Webhook 需以 https:// 开头');
    else if (!WEBHOOK_URL_PATTERNS.dingtalk.test(url)) {
      issues.push('群机器人：Webhook 格式不正确');
    }
  }
  if (cfg.app.enabled) {
    if (!trim(cfg.app.clientId)) issues.push('应用：Client ID 未填写');
    if (!trim(cfg.app.clientSecret)) issues.push('应用：Client Secret 未填写');
  }
  return issues;
}

function checkFeishu(cfg: FeishuChannel): string[] {
  const issues: string[] = [];
  if (!cfg.webhook.enabled && !cfg.app.enabled) {
    issues.push('请至少启用群机器人或应用');
    return issues;
  }
  if (cfg.webhook.enabled) {
    const url = trim(cfg.webhook.url);
    if (!url) issues.push('群机器人：Webhook 未填写');
    else if (!url.startsWith('https://')) issues.push('群机器人：Webhook 需以 https:// 开头');
    else if (!WEBHOOK_URL_PATTERNS.feishu.test(url)) {
      issues.push('群机器人：Webhook 格式不正确');
    }
  }
  if (cfg.app.enabled) {
    if (!trim(cfg.app.appId)) issues.push('应用：App ID 未填写');
    if (!trim(cfg.app.appSecret)) issues.push('应用：App Secret 未填写');
  }
  return issues;
}

function checkWecom(cfg: WecomChannel): string[] {
  const issues: string[] = [];
  if (!cfg.webhook.enabled && !cfg.app.enabled) {
    issues.push('请至少启用群机器人或应用');
    return issues;
  }
  if (cfg.webhook.enabled && !trim(cfg.webhook.webhookKey)) {
    issues.push('群机器人：Webhook Key 未填写');
  }
  if (cfg.app.enabled) {
    if (!trim(cfg.app.corpId)) issues.push('应用：Corp ID 未填写');
    if (!trim(cfg.app.corpSecret)) issues.push('应用：Corp Secret 未填写');
    if (!trim(cfg.app.agentId)) issues.push('应用：Agent ID 未填写');
  }
  return issues;
}

/** 前端本地预校验，减少无效请求 */
export function evaluateChannelConnectivity(
  channel: NotifyChannel,
  config: NotificationConfig,
): ConnectivityTestResult {
  const merged = mergeNotificationConfig(config);

  if (!merged.enabled) {
    return {
      status: 'error',
      message: '请先开启顶部「启用消息通知」',
      details: [],
    };
  }

  const cfg = merged.channels[channel];
  let issues: string[] = [];
  if (channel === 'dingtalk') issues = checkDingTalk(cfg as DingTalkChannel);
  else if (channel === 'feishu') issues = checkFeishu(cfg as FeishuChannel);
  else issues = checkWecom(cfg as WecomChannel);

  if (issues.length > 0) {
    return {
      status: 'error',
      message: `${CHANNEL_LABELS[channel]}配置未通过校验`,
      details: issues,
    };
  }

  return {
    status: 'success',
    message: `${CHANNEL_LABELS[channel]}配置校验通过`,
    details: [],
  };
}

function parseApiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return '连通性测试请求失败';
  const raw = error.message.trim();
  if (!raw) return '连通性测试请求失败';
  try {
    const parsed = JSON.parse(raw) as { detail?: string };
    if (typeof parsed.detail === 'string' && parsed.detail) {
      return parsed.detail;
    }
  } catch {
    // 非 JSON 响应
  }
  return raw;
}

export async function runChannelConnectivityTest(
  channel: NotifyChannel,
  config: NotificationConfig,
): Promise<ConnectivityTestResult> {
  try {
    const merged = mergeNotificationConfig(config);
    const local = evaluateChannelConnectivity(channel, merged);
    if (local.status === 'error') {
      return local;
    }

    const result = await api.testNotificationChannel(channel, merged);
    return {
      status: result.status,
      message: result.message,
      details: Array.isArray(result.details) ? result.details : [],
    };
  } catch (error) {
    return {
      status: 'error',
      message: parseApiErrorMessage(error),
      details: [],
    };
  }
}

export function connectivityStatusLabel(status: ConnectivityStatus): string {
  switch (status) {
    case 'testing':
      return '测试中';
    case 'success':
      return '已连通';
    case 'error':
      return '未通过';
    default:
      return '未测试';
  }
}
