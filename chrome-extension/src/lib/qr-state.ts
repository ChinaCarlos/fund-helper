/** 养基宝 QR 状态：API 可能返回 string 或 number */
export function normalizeQrState(state: unknown): string {
  if (state === null || state === undefined) return '';
  return String(state);
}

export function isQrLoginSuccess(state: unknown): boolean {
  return normalizeQrState(state) === '2';
}

export function isQrExpired(state: unknown): boolean {
  return normalizeQrState(state) === '3';
}
