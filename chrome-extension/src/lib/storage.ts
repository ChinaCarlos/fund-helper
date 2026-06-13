import type { YjbSession } from '@/types/portfolio';

const STORAGE_KEY = 'yjb_session';

export async function loadSession(): Promise<YjbSession | null> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return (data[STORAGE_KEY] as YjbSession | undefined) ?? null;
}

export async function saveSession(session: YjbSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
