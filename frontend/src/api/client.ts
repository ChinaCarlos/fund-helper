import type {
  AccountListResponse,
  AddFundItemPayload,
  AuthStatus,
  IncomeLineData,
  PortfolioSnapshot,
  QrCodeResponse,
  QrStatusResponse,
  SearchFundItem,
} from '@/types/portfolio';
import type { ConnectivityTestResult } from '@/utils/notificationConnectivity';
import type { NotificationConfig, NotifyChannel } from '@/utils/notificationSettings';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || response.statusText);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getAuthStatus: () => request<AuthStatus>('/api/auth/status'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  createQrcode: () =>
    request<QrCodeResponse>('/api/auth/qrcode', { method: 'POST' }),
  getQrcodeStatus: (id: string) =>
    request<QrStatusResponse>(`/api/auth/qrcode/${id}/status`),
  getPortfolio: () => request<PortfolioSnapshot>('/api/portfolio'),
  getAccounts: () => request<AccountListResponse>('/api/accounts'),
  /** 汇总曲线：collect=true */
  getCollectIncomeLine: () =>
    request<IncomeLineData>('/api/income/line?collect=true'),
  /** 各账户独立曲线：account_ids[] */
  getAccountIncomeLines: (accountIds: number[]) => {
    const params = new URLSearchParams();
    for (const id of accountIds) {
      params.append('account_ids[]', String(id));
    }
    return request<Record<string, IncomeLineData>>(
      `/api/income/lines?${params}`,
    );
  },
  /** 单账户曲线（内部仍走 account_ids[]） */
  getIncomeLine: (options?: { accountId?: number; collect?: boolean }) => {
    if (options?.collect) {
      return request<IncomeLineData>('/api/income/line?collect=true');
    }
    if (options?.accountId != null) {
      return request<IncomeLineData>(
        `/api/income/line?account_ids[]=${options.accountId}`,
      );
    }
    return request<IncomeLineData>('/api/income/line?collect=true');
  },
  searchFunds: (keyword: string, accountId?: number) => {
    const params = new URLSearchParams({ keyword });
    if (accountId != null) {
      params.set('account_id', String(accountId));
    }
    return request<SearchFundItem[]>(`/api/funds/search?${params}`);
  },
  addFundHold: (accountId: number, items: AddFundItemPayload[]) =>
    request<{ ok: boolean }>('/api/funds/hold', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, items }),
    }),
  removeFundHold: (accountId: number, fundIds: number[]) => {
    const params = new URLSearchParams({ account_id: String(accountId) });
    for (const id of fundIds) {
      params.append('fund_ids[]', String(id));
    }
    return request<{ ok: boolean }>(`/api/funds/hold?${params}`, {
      method: 'DELETE',
    });
  },
  getNotificationConfig: () =>
    request<{ config: NotificationConfig | null }>('/api/notify/config'),
  listDeliveryTargets: (channel: NotifyChannel, config: NotificationConfig) =>
    request<{
      status: 'success' | 'error';
      message: string;
      chats: Array<{ id: string; name: string; kind: string }>;
    }>(`/api/notify/delivery-targets/${channel}`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    }),
  createFeishuNotificationGroup: (
    config: NotificationConfig,
    payload: { mobile: string; groupName: string },
  ) =>
    request<{
      status: 'success' | 'error';
      message: string;
      chatId: string;
      chatName: string;
      reused: boolean;
    }>('/api/notify/feishu/create-notification-group', {
      method: 'POST',
      body: JSON.stringify({
        config,
        mobile: payload.mobile,
        groupName: payload.groupName,
      }),
    }),
  saveNotificationConfig: (config: NotificationConfig) =>
    request<{ config: NotificationConfig }>('/api/notify/config', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    }),
  testNotificationChannel: (channel: NotifyChannel, config: NotificationConfig) =>
    request<ConnectivityTestResult>('/api/notify/test', {
      method: 'POST',
      body: JSON.stringify({ channel, config }),
    }),
  pushNotification: () =>
    request<{
      status: 'success' | 'partial' | 'error' | 'skipped';
      message: string;
      results: Array<{ channel: string; status: string; message: string }>;
    }>('/api/notify/push', {
      method: 'POST',
    }),
};
