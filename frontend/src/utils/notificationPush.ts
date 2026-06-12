import { api } from '@/api/client';
import {
  loadNotificationSettings,
  type NotificationConfig,
} from '@/utils/notificationSettings';

export interface PushResult {
  status: 'success' | 'partial' | 'error' | 'skipped';
  message: string;
}

/** 刷新成功后按触发配置尝试推送持仓收益通知 */
export async function tryPushAfterRefresh(options?: {
  trading?: boolean;
}): Promise<PushResult | null> {
  const config = loadNotificationSettings();
  if (!config.enabled) return null;
  if (config.trigger.frequency !== 'manual') return null;
  if (config.trigger.tradingHoursOnly && options?.trading === false) {
    return { status: 'skipped', message: '非交易时段，已跳过推送' };
  }

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

export function shouldNotifyOnManualRefresh(config: NotificationConfig): boolean {
  return config.enabled && config.trigger.frequency === 'manual';
}
