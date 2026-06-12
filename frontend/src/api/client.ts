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
};
