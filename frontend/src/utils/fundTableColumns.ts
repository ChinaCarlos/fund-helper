import type { FundItem } from '@/types/portfolio';

export type FundColumnKey =
  | 'hold_sum'
  | 'day_earn'
  | 'gzjz'
  | 'dwjz'
  | 'money'
  | 'hold_share'
  | 'hold_cost'
  | 'gszzl'
  | 'jzzzl'
  | 'hold_earn';

export const FUND_COLUMN_LABELS: Record<FundColumnKey, string> = {
  hold_sum: '持有金额',
  day_earn: '当日收益',
  gzjz: '估值净值',
  dwjz: '单位净值',
  money: '市值',
  hold_share: '持有份额',
  hold_cost: '成本价',
  gszzl: '估算涨跌',
  jzzzl: '净值涨跌',
  hold_earn: '持有收益',
};

/** 默认列顺序：优先展示持有金额、当日收益、估值净值、单位净值 */
export const DEFAULT_COLUMN_ORDER: FundColumnKey[] = [
  'hold_sum',
  'day_earn',
  'gzjz',
  'dwjz',
  'money',
  'hold_share',
  'hold_cost',
  'gszzl',
  'jzzzl',
  'hold_earn',
];

export const DEFAULT_VISIBLE_COLUMNS: FundColumnKey[] = [...DEFAULT_COLUMN_ORDER];

const STORAGE_KEY = 'fund-helper-fund-table-visible-columns';

export function loadVisibleColumns(): FundColumnKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE_COLUMNS;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((k): k is FundColumnKey =>
      DEFAULT_COLUMN_ORDER.includes(k as FundColumnKey),
    );
    return valid.length > 0 ? valid : DEFAULT_VISIBLE_COLUMNS;
  } catch {
    return DEFAULT_VISIBLE_COLUMNS;
  }
}

export function saveVisibleColumns(keys: FundColumnKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function sortFundValue(fund: FundItem, key: FundColumnKey): number {
  switch (key) {
    case 'day_earn':
      return fund.day_earn;
    case 'money':
      return fund.money;
    case 'hold_share':
      return fund.hold_share;
    case 'hold_cost':
      return fund.hold_cost;
    case 'hold_sum':
      return fund.hold_sum;
    case 'dwjz':
      return fund.nv_info?.dwjz ?? 0;
    case 'gzjz':
      return fund.nv_info?.gzjz ?? 0;
    case 'gszzl':
      return fund.nv_info?.gszzl ?? 0;
    case 'jzzzl':
      return fund.nv_info?.jzzzl ?? 0;
    case 'hold_earn':
      return fund.hold_earn;
    default:
      return 0;
  }
}

export function fundColumnSorter(key: FundColumnKey) {
  return (a: FundItem, b: FundItem) => sortFundValue(a, key) - sortFundValue(b, key);
}
