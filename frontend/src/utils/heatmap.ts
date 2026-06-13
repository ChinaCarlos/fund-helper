import type { HeatmapItem } from '@/types/market';

export function heatmapValue(
  item: HeatmapItem,
  kind: 'sector_change' | 'fund_flow',
): number | null {
  if (kind === 'fund_flow') return item.net_flow;
  return item.change_rate;
}

export function heatmapValueLabel(
  item: HeatmapItem,
  kind: 'sector_change' | 'fund_flow',
): string {
  const value = heatmapValue(item, kind);
  if (value == null) return '-';
  if (kind === 'fund_flow') {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}亿`;
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function heatmapCellStyle(value: number | null, max: number, min: number) {
  if (value == null) {
    return { background: '#f3f4f6', color: '#6b7280' };
  }
  if (value > 0) {
    const intensity = max > 0 ? Math.min(value / max, 1) : 0.5;
    const alpha = 0.18 + intensity * 0.62;
    return {
      background: `rgba(252, 78, 80, ${alpha})`,
      color: intensity > 0.45 ? '#fff' : '#7f1d1d',
    };
  }
  if (value < 0) {
    const intensity = min < 0 ? Math.min(Math.abs(value) / Math.abs(min), 1) : 0.5;
    const alpha = 0.18 + intensity * 0.62;
    return {
      background: `rgba(34, 197, 94, ${alpha})`,
      color: intensity > 0.45 ? '#fff' : '#14532d',
    };
  }
  return { background: '#f8fafc', color: '#64748b' };
}

export function heatmapExtents(items: HeatmapItem[], kind: 'sector_change' | 'fund_flow') {
  const values = items
    .map((item) => heatmapValue(item, kind))
    .filter((value): value is number => value != null);
  if (values.length === 0) return { max: 1, min: -1 };
  return {
    max: Math.max(...values, 0.01),
    min: Math.min(...values, -0.01),
  };
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface BuiltSeriesChart {
  coords: Array<{ x: number; y: number; point: SeriesPoint; index: number }>;
  linePath: string;
  areaPath: string;
  minValue: number;
  maxValue: number;
  zeroY: number | null;
}

export interface ChartSeriesConfig {
  key: string;
  label: string;
  color: string;
  points: SeriesPoint[];
  dashed?: boolean;
}

export function alignSeriesToDates(points: SeriesPoint[], dates: string[]): SeriesPoint[] {
  const valueMap = new Map(points.map((point) => [point.label, point.value]));
  let lastValue: number | null = null;
  return dates.map((date) => {
    const direct = valueMap.get(date);
    if (direct != null) {
      lastValue = direct;
      return { label: date, value: direct };
    }
    if (lastValue != null) {
      return { label: date, value: lastValue };
    }
    return null;
  }).filter((point): point is SeriesPoint => point != null);
}

export function buildMultiSeriesChart(
  allSeries: SeriesPoint[][],
  width: number,
  height: number,
  pad: { top: number; right: number; bottom: number; left: number },
): BuiltSeriesChart | null {
  const flatValues = allSeries.flatMap((series) => series.map((point) => point.value));
  if (flatValues.length === 0) return null;
  const reference = allSeries.find((series) => series.length > 0) ?? [];
  return buildSeriesChart(reference, width, height, pad, flatValues);
}

export function buildSeriesChart(
  points: SeriesPoint[],
  width: number,
  height: number,
  pad: { top: number; right: number; bottom: number; left: number },
  valuePool?: number[],
): BuiltSeriesChart | null {
  if (points.length === 0) return null;

  const values = valuePool ?? points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue || 1;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const coords = points.map((point, index) => {
    const x =
      points.length <= 1
        ? pad.left
        : pad.left + (index / (points.length - 1)) * innerW;
    const y = pad.top + ((maxValue - point.value) / span) * innerH;
    return { x, y, point, index };
  });

  const linePath = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${coords.at(-1)?.x ?? pad.left} ${height - pad.bottom} L ${coords[0]?.x ?? pad.left} ${height - pad.bottom} Z`;

  const zeroY =
    minValue <= 0 && maxValue >= 0
      ? pad.top + ((maxValue - 0) / span) * innerH
      : null;

  return { coords, linePath, areaPath, minValue, maxValue, zeroY };
}

export function pickNearestSeriesIndex(
  points: SeriesPoint[],
  clientX: number,
  rect: DOMRect,
  width: number,
  pad: { left: number; right: number },
): number {
  if (points.length === 0) return 0;
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  const innerW = width - pad.left - pad.right;
  const x = ratio * width;
  let nearest = 0;
  let minDist = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    const pointX =
      points.length <= 1
        ? pad.left
        : pad.left + (index / (points.length - 1)) * innerW;
    const dist = Math.abs(pointX - x);
    if (dist < minDist) {
      minDist = dist;
      nearest = index;
    }
  }
  return nearest;
}

export function formatCurveXLabel(date: string, total: number): string {
  if (total <= 8) return date.slice(5);
  const month = date.slice(5, 7);
  const day = date.slice(8, 10);
  return `${month}/${day}`;
}
