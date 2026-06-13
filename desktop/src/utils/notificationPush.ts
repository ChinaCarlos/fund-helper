import { api } from '@/lib/tauri-api';

export interface PushResult {
  status: 'success' | 'partial' | 'error' | 'skipped';
  message: string;
}

export async function tryPushAfterRefresh(): Promise<PushResult | null> {
  try {
    const result = await api.pushNotificationIfManual();
    if (!result) return null;
    if (result.status !== 'success') {
      console.info('[notify-push]', result.status, result.message, result.results);
    }
    return {
      status: result.status,
      message: result.message,
    };
  } catch (err) {
    console.warn('[notify-push] failed', err);
    return null;
  }
}
