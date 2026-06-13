export interface FundNvInfo {
  dwjz: number;
  gzjz: number;
  gszzl: number;
  jzzzl: number;
}

export interface FundItem {
  id?: number;
  fund_id?: number;
  code: string;
  short_name: string;
  sector?: string;
  money: number;
  hold_share?: number;
  hold_cost?: number;
  hold_sum: number;
  hold_earn: number;
  day_earn: number;
  day_rate: number;
  account_id?: number;
  account_title?: string;
  nv_info?: FundNvInfo;
}

export interface AccountItem {
  account_id: number;
  title: string;
  today_income: number;
  today_income_rate: number;
  hold_income: number;
  hold_income_rate: number;
  account_assets: number;
  up: number;
  down: number;
  funds: FundItem[];
}

export interface IndexItem {
  code: string;
  name?: string;
  v?: string;
  dir: number;
}

export interface PortfolioSnapshot {
  total_assets: number;
  today_income: number;
  today_income_rate: number;
  rise_count: number;
  fall_count: number;
  accounts: AccountItem[];
  funds: FundItem[];
  indices: IndexItem[];
  updated_at: string;
  trading: boolean;
}

export interface AuthStatus {
  bound: boolean;
  nickname: string;
  avatar: string;
  login_time: string;
}

export interface QrCreateResult {
  id: string;
  url: string;
}

export interface QrStateResult {
  state: string | number;
  token?: string;
  nickname?: string;
  avatar?: string;
}

export interface CommandErrorPayload {
  message: string;
  status_code: number;
}

export interface IncomeLinePoint {
  label: string;
  rate: number;
}

export interface IncomeLineData {
  account_id?: number;
  day: string;
  today_income: number;
  points: IncomeLinePoint[];
}

export interface PushChannelResult {
  channel: string;
  status: string;
  message: string;
}

export interface PushResponse {
  status: 'success' | 'partial' | 'error' | 'skipped';
  message: string;
  results: PushChannelResult[];
}

export interface DeliveryTargetsResponse {
  status: 'success' | 'error';
  message: string;
  chats: Array<{ id: string; name: string; kind: string }>;
}

export interface FeishuCreateGroupResponse {
  status: 'success' | 'error';
  message: string;
  chatId: string;
  chatName: string;
  reused: boolean;
}
