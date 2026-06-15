export function normalizeQrState(state: unknown): string {
  if (state === null || state === undefined) return '';
  const text = String(state).trim();
  const numeric = Number(text);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return String(Math.trunc(numeric));
  }
  return text.replace(/\.0+$/, '');
}

export function isQrLoginSuccess(state: unknown): boolean {
  return normalizeQrState(state) === '2';
}

export function isQrExpired(state: unknown): boolean {
  return normalizeQrState(state) === '3';
}
