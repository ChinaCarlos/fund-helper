import { api } from '@/api/client';
import { getNotificationConfig } from '@/services/notificationConfig';
import {
  getNotifyIntervalMs,
  type NotificationConfig,
  type NotifyFrequency,
} from '@/utils/notificationSettings';

export interface PushResult {
  status: 'success' | 'partial' | 'error' | 'skipped';
  message: string;
}

async function executePush(): Promise<PushResult | null> {
  try {
    const result = await api.pushNotification();
    return {
      status: result.status,
      message: result.message,
    };
  } catch {
    return null;
  }
}

function shouldSkipForTradingHours(
  config: NotificationConfig,
  trading?: boolean,
): PushResult | null {
  if (config.trigger.tradingHoursOnly && trading === false) {
    return { status: 'skipped', message: '非交易时段，已跳过推送' };
  }
  return null;
}

/** 刷新成功后按触发配置尝试推送持仓收益通知（仅 manual 模式） */
export async function tryPushAfterRefresh(options?: {
  trading?: boolean;
}): Promise<PushResult | null> {
  const config = getNotificationConfig();
  if (!config.enabled) return null;
  if (config.trigger.frequency !== 'manual') return null;

  const skip = shouldSkipForTradingHours(config, options?.trading);
  if (skip) return skip;

  return executePush();
}

/** 定时任务触发推送（1m / 5m / 15m / 30m / 60m） */
export async function tryScheduledPush(): Promise<PushResult | null> {
  const config = getNotificationConfig();
  if (!config.enabled) return null;
  if (!getNotifyIntervalMs(config.trigger.frequency)) return null;

  return executePush();
}

export function shouldNotifyOnManualRefresh(config: NotificationConfig): boolean {
  return config.enabled && config.trigger.frequency === 'manual';
}

export function isScheduledNotifyFrequency(frequency: NotifyFrequency): boolean {
  return getNotifyIntervalMs(frequency) !== null;
}
