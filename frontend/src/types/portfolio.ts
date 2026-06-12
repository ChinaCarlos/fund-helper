export interface FundNvInfo {
  dwjz: number;
  gzjz: number;
  gsz: number;
  gszzl: number;
  jzzzl: number;
  jzrq: string;
  gztime: string;
}

export interface FundItem {
  id: number;
  fund_id: number;
  account_id?: number;
  account_title?: string;
  code: string;
  short_name: string;
  money: number;
  hold_sum: number;
  hold_earn: number;
  hold_share: number;
  hold_cost: number;
  is_fuzzy: boolean;
  has_aip: number;
  has_up_down_remid: number;
  fh_amount: number;
  day_earn: number;
  day_rate: number;
  nv_time?: string;
  nv_info?: FundNvInfo;
  sector?: string | null;
}

export interface SearchFundItem {
  id: number;
  code: string;
  short_name: string;
  name?: string;
  simple_pinyin?: string;
  category?: number;
  purchase_status?: number;
  redemption_status?: number;
  themes?: string[];
  is_hold: boolean;
  is_optional?: boolean;
  group_ids?: number[];
}

export interface AddFundItemPayload {
  fund_id: number;
  fund_code: string;
  hold_share: string;
  hold_cost: string;
  model?: number;
}

export interface AccountListResponse {
  is_single_account_model: boolean;
  target_account_id?: number;
  list: Array<{
    id: number;
    title: string;
    type?: number;
  }>;
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
  updated_at?: string;
  trading?: boolean;
  user?: {
    nickname?: string;
    avatar?: string;
  };
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

export interface AuthStatus {
  logged_in: boolean;
  nickname?: string;
  avatar?: string;
  login_time?: string;
}

export interface QrCodeResponse {
  id: string;
  url: string;
  image_base64: string;
}

export interface QrStatusResponse {
  state: string;
  nickname?: string;
  avatar?: string;
}

export type WsMessage =
  | { type: 'portfolio_update'; data: PortfolioSnapshot }
  | { type: 'auth_required' }
  | { type: 'auth_ok'; data: { nickname?: string; avatar?: string } }
  | { type: 'error'; message: string };
