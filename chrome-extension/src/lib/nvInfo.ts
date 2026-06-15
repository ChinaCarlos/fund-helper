/**
 * 养基宝 fund_hold → nv_info 字段归一化
 * 字段优先级见 API_README.md §7
 */

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

export function toFloat(value: unknown, fallback = 0): number {
  if (!isPresent(value)) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function pickFirstFloat(
  nv: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    if (isPresent(nv[key])) {
      return toFloat(nv[key], fallback);
    }
  }
  return fallback;
}

export function pickEstimateRate(nv: Record<string, unknown>): number {
  return pickFirstFloat(nv, ['gszzl', 'zsgzzl', 'vgszzl']);
}

export function pickPublishedRate(nv: Record<string, unknown>): number {
  return pickFirstFloat(nv, ['jzzzl', 'rzzl']);
}

export function pickEstimateNav(nv: Record<string, unknown>): number {
  return pickFirstFloat(nv, ['gzjz', 'zsgz', 'gsz', 'vgsz']);
}

function localDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isNavDateToday(jzrq: unknown): boolean {
  if (!isPresent(jzrq)) return false;
  return String(jzrq).slice(0, 10) === localDateString();
}

export function isNavPublishedToday(nv: Record<string, unknown>): boolean {
  if (isPresent(nv.gszzl)) return true;
  const jzrq = nv.jzrq ?? nv.zxjzrq ?? nv.true_valuation_date;
  return isNavDateToday(jzrq);
}

export function pickRateForDayEarn(nv: Record<string, unknown>): number {
  const estimate = pickEstimateRate(nv);
  if (estimate !== 0) return estimate;
  return pickPublishedRate(nv);
}

export function pickDisplayRate(nv: Record<string, unknown>): number {
  const estimate = pickEstimateRate(nv);
  if (estimate !== 0) return estimate;
  return pickPublishedRate(nv);
}

export function calcFundDayEarnFromNv(
  money: number,
  nv: Record<string, unknown>,
): number {
  const rate = pickRateForDayEarn(nv);
  return Math.round((money * rate) / 100 * 100) / 100;
}

export function normalizeFundNvInfo(nv: Record<string, unknown>) {
  const gszzl = pickEstimateRate(nv);
  const jzzzl = pickPublishedRate(nv);
  const dayRate = gszzl !== 0 ? gszzl : jzzzl;
  const navUpdated = isNavPublishedToday(nv);
  const jzrq = isPresent(nv.jzrq) ? String(nv.jzrq).slice(0, 10) : '';
  return {
    gszzl,
    jzzzl,
    dayRate,
    dwjz: pickFirstFloat(nv, ['dwjz']),
    gzjz: pickEstimateNav(nv),
    navUpdated,
    jzrq,
  };
}
