import type { FundRankItem } from '@/types/market';

export type MarketRankColumnKey =
  | 'rank'
  | 'code'
  | 'name'
  | 'estimate_rate'
  | 'estimate_nav'
  | 'estimate_deviation'
  | 'nav'
  | 'acc_nav'
  | 'day'
  | 'published_day_rate'
  | 'week1'
  | 'month1'
  | 'month3'
  | 'month6'
  | 'year1'
  | 'year2'
  | 'year3'
  | 'ytd'
  | 'since_found'
  | 'custom_rate'
  | 'fund_type'
  | 'sector'
  | 'fee'
  | 'nav_date'
  | 'min_purchase'
  | 'tracking_target'
  | 'tracking_method';

export const MARKET_RANK_COLUMN_LABELS: Record<MarketRankColumnKey, string> = {
  rank: '排名',
  code: '基金代码',
  name: '基金名称',
  estimate_rate: '实时估计涨幅',
  estimate_nav: '估算净值',
  estimate_deviation: '估算偏差',
  nav: '单位净值',
  acc_nav: '累计净值',
  day: '当天涨幅',
  published_day_rate: '公布日涨幅',
  week1: '近 1 周',
  month1: '近 1 月涨幅',
  month3: '近 3 月',
  month6: '近 6 月涨幅',
  year1: '近 1 年涨幅',
  year2: '近 2 年',
  year3: '近 3 年',
  ytd: '今年来',
  since_found: '成立来',
  custom_rate: '自定义',
  fund_type: '基金类型',
  sector: '板块/主题',
  fee: '手续费',
  nav_date: '净值日期',
  min_purchase: '起购金额',
  tracking_target: '跟踪标的',
  tracking_method: '跟踪方式',
};

/** 仅交易时段展示的列 */
export const TRADING_ONLY_MARKET_RANK_COLUMNS: MarketRankColumnKey[] = ['estimate_rate'];

/** 排行维度列（表格内展示，非筛选项） */
export const RANK_DIMENSION_COLUMNS: MarketRankColumnKey[] = [
  'day',
  'week1',
  'month1',
  'month3',
  'month6',
  'year1',
  'year2',
  'year3',
  'estimate_rate',
];

export const DEFAULT_MARKET_RANK_COLUMN_ORDER: MarketRankColumnKey[] = [
  'rank',
  'code',
  'name',
  'estimate_rate',
  'estimate_nav',
  'estimate_deviation',
  'published_day_rate',
  'nav',
  'acc_nav',
  'nav_date',
  'day',
  'week1',
  'month1',
  'month3',
  'month6',
  'year1',
  'year2',
  'year3',
  'ytd',
  'since_found',
  'custom_rate',
  'fund_type',
  'sector',
  'fee',
  'min_purchase',
  'tracking_target',
  'tracking_method',
];

export const DEFAULT_VISIBLE_MARKET_RANK_COLUMNS: MarketRankColumnKey[] = [
  ...DEFAULT_MARKET_RANK_COLUMN_ORDER,
];

const STORAGE_KEY = 'fund-helper-market-rank-visible-columns-v2';

export function loadMarketRankVisibleColumns(): MarketRankColumnKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE_MARKET_RANK_COLUMNS;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((key): key is MarketRankColumnKey =>
      DEFAULT_MARKET_RANK_COLUMN_ORDER.includes(key as MarketRankColumnKey),
    );
    return valid.length > 0 ? valid : DEFAULT_VISIBLE_MARKET_RANK_COLUMNS;
  } catch {
    return DEFAULT_VISIBLE_MARKET_RANK_COLUMNS;
  }
}

export function saveMarketRankVisibleColumns(keys: MarketRankColumnKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function getMarketRankCellValue(
  item: FundRankItem,
  key: MarketRankColumnKey,
): string | number | null {
  switch (key) {
    case 'rank':
      return item.rank;
    case 'code':
      return item.code;
    case 'name':
      return item.name;
    case 'estimate_rate':
      return item.estimate_rate;
    case 'estimate_nav':
      return item.estimate_nav;
    case 'estimate_deviation':
      return item.estimate_deviation;
    case 'nav':
      return item.nav;
    case 'acc_nav':
      return item.acc_nav;
    case 'day':
      return item.day;
    case 'published_day_rate':
      return item.published_day_rate;
    case 'week1':
      return item.week1;
    case 'month1':
      return item.month1;
    case 'month3':
      return item.month3;
    case 'month6':
      return item.month6;
    case 'year1':
      return item.year1;
    case 'year2':
      return item.year2;
    case 'year3':
      return item.year3;
    case 'ytd':
      return item.ytd;
    case 'since_found':
      return item.since_found;
    case 'custom_rate':
      return item.custom_rate;
    case 'fund_type':
      return item.fund_type;
    case 'sector':
      return item.sector;
    case 'fee':
      return item.fee;
    case 'nav_date':
      return item.nav_date;
    case 'min_purchase':
      return item.min_purchase;
    case 'tracking_target':
      return item.tracking_target;
    case 'tracking_method':
      return item.tracking_method;
    default:
      return null;
  }
}

export function isPercentMarketRankColumn(key: MarketRankColumnKey): boolean {
  return [
    'estimate_rate',
    'estimate_deviation',
    'day',
    'published_day_rate',
    'week1',
    'month1',
    'month3',
    'month6',
    'year1',
    'year2',
    'year3',
    'ytd',
    'since_found',
    'custom_rate',
  ].includes(key);
}

export function isNavMarketRankColumn(key: MarketRankColumnKey): boolean {
  return ['nav', 'acc_nav', 'estimate_nav'].includes(key);
}

export function isRankDimensionColumn(key: MarketRankColumnKey): boolean {
  return RANK_DIMENSION_COLUMNS.includes(key);
}

export function isTradingOnlyMarketRankColumn(key: MarketRankColumnKey): boolean {
  return TRADING_ONLY_MARKET_RANK_COLUMNS.includes(key);
}

export function filterMarketRankColumnsForTrading(
  keys: MarketRankColumnKey[],
  trading: boolean,
  activeSortColumn?: MarketRankColumnKey,
): MarketRankColumnKey[] {
  if (trading) return keys;
  return keys.filter((key) => {
    if (!isTradingOnlyMarketRankColumn(key)) return true;
    return key === activeSortColumn;
  });
}
