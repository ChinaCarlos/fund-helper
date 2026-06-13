import type { CSSProperties } from 'react';

export function formatMoney(value: number, digits = 2): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}${abs.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}${abs.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function colorClass(value: number): 'rise' | 'fall' | 'flat' {
  if (value > 0) return 'rise';
  if (value < 0) return 'fall';
  return 'flat';
}

export function trendColor(value: number): string {
  if (value > 0) return '#fc4e50';
  if (value < 0) return '#07b360';
  return '#8b95a8';
}

const MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/** Tab 区域当日收益主数字样式 */
export function incomeAmountStyle(value: number): CSSProperties {
  return {
    color: trendColor(value),
    fontSize: 24,
    fontWeight: 700,
    fontFamily: MONO,
    lineHeight: 1.3,
  };
}
