export function normalizeQrState(state: unknown): string {
  if (state === null || state === undefined) return "";
  return String(state);
}

export function isQrLoginSuccess(state: unknown): boolean {
  return normalizeQrState(state) === "2";
}

export function isQrExpired(state: unknown): boolean {
  return normalizeQrState(state) === "3";
}

export function isQrWaiting(state: unknown): boolean {
  const normalized = normalizeQrState(state);
  return normalized === "" || normalized === "1";
}

/** 登录成功响应里 token 可能为空字符串，需 trim 后判断 */
export function extractQrToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}
