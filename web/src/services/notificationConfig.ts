import { api } from '@/api/client';
import {
  createDefaultNotificationConfig,
  mergeNotificationConfig,
  NOTIFICATION_CONFIG_CHANGED_EVENT,
  sanitizeNotificationConfig,
  type NotificationConfig,
} from '@/utils/notificationSettings';

let cache: NotificationConfig | null = null;

export function getNotificationConfig(): NotificationConfig {
  return cache ?? createDefaultNotificationConfig();
}

export function setNotificationConfig(config: NotificationConfig) {
  cache = sanitizeNotificationConfig(config);
  window.dispatchEvent(new Event(NOTIFICATION_CONFIG_CHANGED_EVENT));
}

export async function syncNotificationConfigFromServer(): Promise<NotificationConfig> {
  try {
    const { config } = await api.getNotificationConfig();
    const next = config ? mergeNotificationConfig(config) : createDefaultNotificationConfig();
    setNotificationConfig(next);
    return next;
  } catch {
    const fallback = createDefaultNotificationConfig();
    setNotificationConfig(fallback);
    return fallback;
  }
}

export function clearNotificationConfigCache() {
  cache = null;
}
