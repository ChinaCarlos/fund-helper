import type { FundItem } from '@/types/portfolio';

export type FundRateTagKind = 'updated' | 'estimate';

/** 涨幅旁的小标签：净值已更新 → 已更新；交易中且仍为估值 → 预估 */
export function fundRateTagKind(
  fund: FundItem,
  trading: boolean,
): FundRateTagKind | null {
  if (fund.nv_info?.nav_updated) {
    return 'updated';
  }
  if (trading) {
    return 'estimate';
  }
  return null;
}

export function fundRateTagLabel(kind: FundRateTagKind): string {
  return kind === 'updated' ? '已更新' : '预估';
}
