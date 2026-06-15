import { yjb } from '@/lib/yjb';
import type { AccountItem, FundItem, IndexItem, PortfolioSnapshot } from '@/types/portfolio';
import {
  calcFundDayEarnFromNv,
  normalizeFundNvInfo,
  toFloat,
} from '@/lib/nvInfo';

function normalizeIndexDir(dirVal: number, divVal: number): number {
  if (dirVal === 0) return 0;
  const absDir = Math.abs(dirVal);
  if (divVal > 0) return absDir;
  if (divVal < 0) return -absDir;
  return dirVal;
}

function enrichFund(
  fund: Record<string, unknown>,
  accountId: number,
  accountTitle: string,
): FundItem {
  const nv = (fund.nv_info as Record<string, unknown> | undefined) ?? {};
  const normalized = normalizeFundNvInfo(nv);
  return {
    id: toFloat(fund.id),
    code: String(fund.code ?? ''),
    short_name: String(fund.short_name ?? ''),
    money: toFloat(fund.money),
    hold_sum: toFloat(fund.hold_sum ?? fund.money),
    hold_earn: toFloat(fund.hold_earn),
    day_earn: calcFundDayEarnFromNv(toFloat(fund.money), nv),
    day_rate: normalized.dayRate,
    account_id: accountId,
    account_title: accountTitle,
    nv_info: {
      dwjz: normalized.dwjz,
      gzjz: normalized.gzjz,
      gszzl: normalized.gszzl,
      jzzzl: normalized.jzzzl,
      nav_updated: normalized.navUpdated,
      jzrq: normalized.jzrq || undefined,
    },
  };
}

export function isTradingHours(): boolean {
  const now = new Date();
  if (now.getDay() === 0 || now.getDay() === 6) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (minutes >= 570 && minutes <= 691) || (minutes >= 810 && minutes <= 901);
}

export async function fetchPortfolioSnapshot(token: string): Promise<PortfolioSnapshot> {
  const [collect, indices] = await Promise.all([
    yjb.getCollect(token),
    yjb.getIndex(token),
  ]);

  const accountData = (collect.account_data as Record<string, unknown>[]) ?? [];
  const fundsByAccount: Record<number, Record<string, unknown>[]> = {};

  for (const acc of accountData) {
    const accountId = Number(acc.account_id);
    fundsByAccount[accountId] = await yjb.getFunds(token, accountId);
  }

  return buildPortfolioSnapshot({ collect, fundsByAccount, indices });
}

function buildPortfolioSnapshot({
  collect,
  fundsByAccount,
  indices,
}: {
  collect: Record<string, unknown>;
  fundsByAccount: Record<number, Record<string, unknown>[]>;
  indices: Record<string, Record<string, unknown>>;
}): PortfolioSnapshot {
  const accounts: AccountItem[] = [];
  const allFunds: FundItem[] = [];
  const accountData = (collect.account_data as Record<string, unknown>[]) ?? [];

  for (const acc of accountData) {
    const accountId = Number(acc.account_id);
    const title = String(acc.title ?? '');
    const funds = (fundsByAccount[accountId] ?? []).map((f) =>
      enrichFund(f, accountId, title),
    );
    funds.sort((a, b) => Math.abs(b.day_earn) - Math.abs(a.day_earn));
    allFunds.push(...funds);
    accounts.push({
      account_id: accountId,
      title,
      today_income: toFloat(acc.today_income),
      today_income_rate: toFloat(acc.today_income_rate),
      hold_income: toFloat(acc.hold_income),
      account_assets: toFloat(acc.account_assets),
      up: Number(acc.up ?? 0),
      down: Number(acc.down ?? 0),
      funds,
    });
  }

  const keyIndices = ['1.000001', '1.000300', '0.399001', '0.399006'];
  const indexList: IndexItem[] = [];
  for (const code of keyIndices) {
    const item = indices[code];
    if (item) {
      indexList.push({
        code,
        name: String(item.name ?? ''),
        v: String(item.v ?? ''),
        dir: normalizeIndexDir(toFloat(item.dir), toFloat(item.div)),
      });
    }
  }

  return {
    total_assets: toFloat(collect.assets_collect),
    today_income: toFloat(collect.today_income),
    today_income_rate: toFloat(collect.today_income_rate),
    rise_count: accountData.reduce((sum, a) => sum + Number(a.up ?? 0), 0),
    fall_count: accountData.reduce((sum, a) => sum + Number(a.down ?? 0), 0),
    accounts,
    funds: allFunds.sort((a, b) => Math.abs(b.day_earn) - Math.abs(a.day_earn)),
    indices: indexList,
    updated_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    trading: isTradingHours(),
  };
}
