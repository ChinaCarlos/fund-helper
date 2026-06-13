import {
  createDefaultNotificationConfig,
  mergeNotificationConfig,
  NOTIFICATION_CONFIG_CHANGED_EVENT,
  sanitizeNotificationConfig,
  type NotificationConfig,
} from '@/utils/notificationSettings';
import { api } from '@/lib/tauri-api';

let cache: NotificationConfig | null = null;

export function getNotificationConfig(): NotificationConfig {
  if (cache) return cache;
  cache = createDefaultNotificationConfig();
  return cache;
}

export function setNotificationConfig(config: NotificationConfig) {
  cache = sanitizeNotificationConfig(config);
  window.dispatchEvent(new Event(NOTIFICATION_CONFIG_CHANGED_EVENT));
}

export async function loadNotificationConfigFromStorage(): Promise<NotificationConfig> {
  try {
    const raw = await api.getNotificationConfig();
    if (raw && raw !== '{}') {
      const next = mergeNotificationConfig(JSON.parse(raw) as Partial<NotificationConfig>);
      setNotificationConfig(next);
      return next;
    }
  } catch {
    /* ignore */
  }
  const fallback = createDefaultNotificationConfig();
  setNotificationConfig(fallback);
  return fallback;
}

export async function persistNotificationConfig(config: NotificationConfig): Promise<void> {
  const next = sanitizeNotificationConfig(config);
  await api.saveNotificationConfig(JSON.stringify(next));
  setNotificationConfig(next);
}

export function clearNotificationConfigCache() {
  cache = null;
}
