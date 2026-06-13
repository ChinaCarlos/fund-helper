import type { FundItem } from '@/types/portfolio';

export type FundSortKey = 'day_earn' | 'hold_sum' | 'day_rate';
export type FundSortOrder = 'desc' | 'asc';

export function fundDayRate(fund: FundItem, trading: boolean): number {
  if (trading) {
    return fund.nv_info?.gszzl ?? fund.day_rate;
  }
  return fund.day_rate;
}

export function fundSortLabel(key: FundSortKey, trading: boolean): string {
  switch (key) {
    case 'day_earn':
      return '当日收益';
    case 'hold_sum':
      return '持仓余额';
    case 'day_rate':
      return trading ? '预估涨幅' : '当日涨幅';
  }
}

export function fundSortValue(
  fund: FundItem,
  key: FundSortKey,
  trading: boolean,
): number {
  switch (key) {
    case 'day_earn':
      return fund.day_earn;
    case 'hold_sum':
      return fund.hold_sum;
    case 'day_rate':
      return fundDayRate(fund, trading);
  }
}

export function compareFunds(
  a: FundItem,
  b: FundItem,
  key: FundSortKey,
  order: FundSortOrder,
  trading: boolean,
): number {
  const diff = fundSortValue(b, key, trading) - fundSortValue(a, key, trading);
  return order === 'desc' ? diff : -diff;
}

export function defaultFundSortKey(trading: boolean): FundSortKey {
  return trading ? 'day_rate' : 'day_earn';
}

export function sortOrderSymbol(order: FundSortOrder): string {
  return order === 'desc' ? '↓' : '↑';
}
