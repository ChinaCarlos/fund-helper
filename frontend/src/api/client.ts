import type {
  CurveOverlaysResponse,
  FundCurveIndicator,
  FundCurveOptionsResponse,
  FundCurvePeriod,
  FundCurveResponse,
  FundRankOptionsResponse,
  FundRankQuery,
  FundRankResponse,
  FundFlowIndicator,
  HeatmapBoardType,
  HeatmapKind,
  HeatmapOptionsResponse,
  HeatmapResponse,
  SectorFundsResponse,
} from '@/types/market';
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
  getMarketRankOptions: () =>
    request<FundRankOptionsResponse>('/api/market/rank/options'),
  getMarketRank: (query: FundRankQuery = {}) => {
    const params = new URLSearchParams();
    if (query.dimension) params.set('dimension', query.dimension);
    if (query.scope) params.set('scope', query.scope);
    if (query.fund_type) params.set('fund_type', query.fund_type);
    if (query.board) params.set('board', query.board);
    if (query.sector) params.set('sector', query.sector);
    if (query.search) params.set('search', query.search);
    if (query.page != null) params.set('page', String(query.page));
    if (query.page_size != null) params.set('page_size', String(query.page_size));
    if (query.order) params.set('order', query.order);
    return request<FundRankResponse>(`/api/market/rank?${params}`);
  },
  getHeatmapOptions: () =>
    request<HeatmapOptionsResponse>('/api/market/heatmap/options'),
  getHeatmap: (query: {
    kind?: HeatmapKind;
    board_type?: HeatmapBoardType;
    indicator?: FundFlowIndicator;
  } = {}) => {
    const params = new URLSearchParams();
    if (query.kind) params.set('kind', query.kind);
    if (query.board_type) params.set('board_type', query.board_type);
    if (query.indicator) params.set('indicator', query.indicator);
    return request<HeatmapResponse>(`/api/market/heatmap?${params}`);
  },
  getFundCurveOptions: (code: string) =>
    request<FundCurveOptionsResponse>(`/api/market/fund/${code}/curve/options`),
  getFundCurve: (
    code: string,
    query: {
      indicator?: FundCurveIndicator;
      period?: FundCurvePeriod;
      name?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (query.indicator) params.set('indicator', query.indicator);
    if (query.period) params.set('period', query.period);
    if (query.name) params.set('name', query.name);
    return request<FundCurveResponse>(`/api/market/fund/${code}/curve?${params}`);
  },
  getSectorFunds: (query: {
    sector: string;
    board_type?: HeatmapBoardType;
    limit?: number;
  }) => {
    const params = new URLSearchParams({ sector: query.sector });
    if (query.board_type) params.set('board_type', query.board_type);
    if (query.limit != null) params.set('limit', String(query.limit));
    return request<SectorFundsResponse>(`/api/market/sector/funds?${params}`);
  },
  getCurveOverlays: (query: {
    period?: FundCurvePeriod;
    sector_name?: string;
    board_type?: HeatmapBoardType;
  } = {}) => {
    const params = new URLSearchParams();
    if (query.period) params.set('period', query.period);
    if (query.sector_name) params.set('sector_name', query.sector_name);
    if (query.board_type) params.set('board_type', query.board_type);
    return request<CurveOverlaysResponse>(`/api/market/curve/overlays?${params}`);
  },
};
