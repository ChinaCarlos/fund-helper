export interface FundNvInfo {
  dwjz: number;
  gzjz: number;
  gszzl: number;
  jzzzl: number;
  /** 当日净值是否已公布（非纯 vgszzl 估值） */
  nav_updated: boolean;
  jzrq?: string;
}

export interface FundItem {
  id?: number;
  code: string;
  short_name: string;
  money: number;
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

export interface YjbSession {
  token: string;
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
