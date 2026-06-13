export type RankDimension =
  | 'day'
  | 'week1'
  | 'month1'
  | 'month3'
  | 'month6'
  | 'year1'
  | 'year2'
  | 'year3'
  | 'estimate_rate';
export type RankScope = 'open' | 'index';
export type RankOrder = 'asc' | 'desc';

export interface FundFieldMeta {
  key: string;
  label: string;
  source: string;
  description?: string;
}

export interface FundRankItem {
  rank: number;
  code: string;
  name: string;
  nav: number | null;
  acc_nav: number | null;
  nav_date: string;
  day: number | null;
  change_rate: number | null;
  estimate_nav: number | null;
  estimate_rate: number | null;
  estimate_deviation: number | null;
  published_day_rate: number | null;
  week1: number | null;
  month1: number | null;
  month3: number | null;
  month6: number | null;
  year1: number | null;
  year2: number | null;
  year3: number | null;
  ytd: number | null;
  since_found: number | null;
  custom_rate: number | null;
  fund_type: string;
  sector: string;
  fee: string;
  min_purchase: string;
  tracking_target: string;
  tracking_method: string;
}

export interface FundRankResponse {
  dimension: RankDimension;
  dimension_label: string;
  scope: RankScope;
  fund_type: string;
  board: string;
  sector: string;
  search: string;
  trading: boolean;
  total: number;
  page: number;
  page_size: number;
  updated_at: string;
  items: FundRankItem[];
}

export interface FundRankOptionsResponse {
  dimensions: { value: RankDimension; label: string }[];
  fund_types: string[];
  index_boards: string[];
  sectors: string[];
  available_fields: FundFieldMeta[];
}

export interface FundRankQuery {
  dimension?: RankDimension;
  scope?: RankScope;
  fund_type?: string;
  board?: string;
  sector?: string;
  search?: string;
  page?: number;
  page_size?: number;
  order?: RankOrder;
}

export type HeatmapKind = 'sector_change' | 'fund_flow';
export type HeatmapBoardType = 'industry' | 'concept';
export type FundFlowIndicator = '今日' | '5日' | '10日';
export type FundCurveIndicator = '累计收益率走势' | '单位净值走势';
export type FundCurvePeriod = '1月' | '3月' | '6月' | '1年' | '3年' | '5年' | '今年来' | '成立来';
export type FundCurveKind = 'open' | 'etf' | 'lof';

export interface HeatmapItem {
  name: string;
  code: string;
  change_rate: number | null;
  net_flow: number | null;
  net_flow_ratio: number | null;
  leading_stock: string;
  leading_stock_change: number | null;
  up_count: number | null;
  down_count: number | null;
}

export interface HeatmapResponse {
  kind: HeatmapKind;
  board_type: HeatmapBoardType;
  indicator: string;
  trading: boolean;
  updated_at: string;
  items: HeatmapItem[];
}

export interface HeatmapOptionsResponse {
  kinds: { value: HeatmapKind; label: string }[];
  board_types: { value: HeatmapBoardType; label: string }[];
  flow_indicators: FundFlowIndicator[];
  sources: { api: string; label: string }[];
}

export interface FundCurvePoint {
  date: string;
  value: number | null;
  nav: number | null;
  change_rate: number | null;
}

export interface FundCurveResponse {
  code: string;
  name: string;
  kind: FundCurveKind;
  source_api: string;
  indicator: FundCurveIndicator;
  period: string;
  points: FundCurvePoint[];
  updated_at: string;
}

export interface FundCurveOptionsResponse {
  kind: FundCurveKind;
  source_api: string;
  indicators: { value: FundCurveIndicator; label: string }[];
  periods: FundCurvePeriod[];
}

export interface SectorFundsResponse {
  sector: string;
  board_type: HeatmapBoardType;
  total: number;
  items: FundRankItem[];
  trading: boolean;
  updated_at: string;
}

export interface CurveOverlayPoint {
  date: string;
  value: number | null;
}

export interface CurveOverlaySeries {
  key: string;
  label: string;
  points: CurveOverlayPoint[];
}

export interface CurveOverlaysResponse {
  period: string;
  sector_name: string;
  board_type: string;
  series: CurveOverlaySeries[];
  updated_at: string;
}

export interface FundCurveOverlayContext {
  sectorName: string;
  boardType: HeatmapBoardType;
}
