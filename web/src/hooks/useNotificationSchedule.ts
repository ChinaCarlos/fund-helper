import { useEffect, useRef } from 'react';
import { getNotificationConfig } from '@/services/notificationConfig';
import {
  getNotifyIntervalMs,
  NOTIFICATION_CONFIG_CHANGED_EVENT,
} from '@/utils/notificationSettings';
import { tryScheduledPush } from '@/utils/notificationPush';

/** 按触发配置定时推送持仓收益通知（1m / 5m / 15m / 30m / 60m） */
export function useNotificationSchedule() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const setup = () => {
      clearTimer();
      const config = getNotificationConfig();
      if (!config.enabled) return;

      const intervalMs = getNotifyIntervalMs(config.trigger.frequency);
      if (!intervalMs) return;

      timerRef.current = setInterval(() => {
        const latest = getNotificationConfig();
        if (!latest.enabled) return;
        if (getNotifyIntervalMs(latest.trigger.frequency) !== intervalMs) return;
        void tryScheduledPush();
      }, intervalMs);
    };

    setup();
    window.addEventListener(NOTIFICATION_CONFIG_CHANGED_EVENT, setup);
    return () => {
      window.removeEventListener(NOTIFICATION_CONFIG_CHANGED_EVENT, setup);
      clearTimer();
    };
  }, []);
}
