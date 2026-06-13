import type { CSSProperties } from 'react';

export function formatMoney(value: number, digits = 2): string {
  const sign = value < 0 ? "-" : "";
  return (
    sign +
    Math.abs(value).toLocaleString("zh-CN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return (
    sign +
    Math.abs(value).toLocaleString("zh-CN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function trendColor(value: number): string {
  if (value > 0) return "#fc4e50";
  if (value < 0) return "#07b360";
  return "#8b95a8";
}

export function colorClass(value: number): string {
  if (value > 0) return "text-rise";
  if (value < 0) return "text-fall";
  return "text-muted-foreground";
}

export function formatRefreshHint(updatedAt: string): string {
  const match = updatedAt.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  return match ? match[1] : updatedAt;
}

export function incomeAmountStyle(value: number): CSSProperties {
  const color = trendColor(value);
  return {
    color,
    fontSize: 22,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  };
}
