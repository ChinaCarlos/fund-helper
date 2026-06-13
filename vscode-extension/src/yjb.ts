import md5 from 'md5';
import type { QrCreateResult, QrStateResult } from './types/portfolio';

const YJB_BASE_URL = 'http://browser-plug-api.yangjibao.com';
const YJB_API_SECRET = 'YxmKSrQR4uoJ5lOoWIhcbd7SlUEh9OOc';

export class YjbApiError extends Error {
  statusCode: number | null;

  constructor(message: string, statusCode: number | null = null) {
    super(message);
    this.name = 'YjbApiError';
    this.statusCode = statusCode;
  }
}

function sign(path: string, token: string, timestamp: number): string {
  return md5(`${path}${token}${timestamp}${YJB_API_SECRET}`);
}

async function yjbRequest<T>(
  method: string,
  path: string,
  options: {
    token?: string;
    params?: Record<string, string | number> | Array<[string, string]>;
    body?: unknown;
  } = {},
): Promise<T> {
  const token = options.token ?? '';
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL(path, YJB_BASE_URL);

  if (options.params) {
    if (Array.isArray(options.params)) {
      for (const [key, value] of options.params) {
        url.searchParams.append(key, value);
      }
    } else {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'Request-Time': String(timestamp),
      'Request-Sign': sign(path, token, timestamp),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    throw new YjbApiError('Token 已失效，请重新登录', 401);
  }

  let payload: { code?: number; message?: string; data?: T };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new YjbApiError(`响应解析失败: ${response.status}`);
  }

  if (response.status === 429) {
    throw new YjbApiError('请求频繁，请稍后再试', 429);
  }

  if (Number(payload.code) !== 200) {
    const message = payload.message ?? String(payload);
    if (/token|登录|授权/i.test(message)) {
      throw new YjbApiError(message, 401);
    }
    throw new YjbApiError(message, response.status);
  }

  return payload.data as T;
}

export const yjb = {
  getQrcode: () => yjbRequest<QrCreateResult>('GET', '/qr_code'),
  getQrcodeState: (qrId: string) =>
    yjbRequest<QrStateResult>('GET', `/qr_code_state/${qrId}`),
  getCollect: (token: string) =>
    yjbRequest<Record<string, unknown>>('GET', '/account_collect', { token }),
  getFunds: (token: string, accountId: number) =>
    yjbRequest<Record<string, unknown>[]>('GET', '/fund_hold', {
      token,
      params: { account_id: accountId },
    }),
  getIndex: (token = '') =>
    yjbRequest<Record<string, Record<string, unknown>>>('GET', '/index_data', { token }),
};
