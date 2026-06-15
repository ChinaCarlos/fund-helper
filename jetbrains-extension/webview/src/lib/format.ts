export function formatMoney(value: number, digits = 2): string {
  const sign = value < 0 ? '-' : '';
  return (
    sign +
    Math.abs(value).toLocaleString('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return (
    sign +
    Math.abs(value).toLocaleString('zh-CN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
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
