import type { IncomeLinePoint } from '@/types/portfolio';

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartCoord {
  x: number;
  y: number;
  point: IncomeLinePoint;
  index: number;
}

export interface BuiltIncomeChart {
  coords: ChartCoord[];
  linePath: string;
  areaPath: string;
  minRate: number;
  maxRate: number;
  baselineY: number;
  zeroY: number | null;
}

export function parseTimeLabel(label: string): number {
  const parts = label.split(':').map(Number);
  const hour = parts[0] ?? 0;
  const minute = parts[1] ?? 0;
  return hour * 60 + minute;
}

export function indexToX(
  index: number,
  pointCount: number,
  width: number,
  pad: ChartPadding,
): number {
  const innerW = width - pad.left - pad.right;
  if (pointCount <= 1) return pad.left;
  return pad.left + (index / (pointCount - 1)) * innerW;
}

export function formatTimeLabel(label: string): string {
  const parts = label.split(':');
  const hour = parts[0] ?? '00';
  const minute = parts[1] ?? '00';
  return `${hour}:${minute}`;
}

export function getSessionXLabels(
  points: IncomeLinePoint[],
  width: number,
  pad: ChartPadding,
): { label: string; x: number; anchor: 'start' | 'end' }[] {
  if (points.length === 0) return [];

  const start = formatTimeLabel(points[0].label);
  const end = formatTimeLabel(points[points.length - 1].label);

  return [
    {
      label: start,
      x: indexToX(0, points.length, width, pad),
      anchor: 'start',
    },
    {
      label: end,
      x: indexToX(points.length - 1, points.length, width, pad),
      anchor: 'end',
    },
  ];
}

export function getSessionTimeRange(points: IncomeLinePoint[]): string {
  if (points.length === 0) return '09:30–15:00';
  return `${formatTimeLabel(points[0].label)}–${formatTimeLabel(points[points.length - 1].label)}`;
}

export function computeYDomain(rates: number[]): { minRate: number; maxRate: number } {
  if (rates.length === 0) return { minRate: -0.5, maxRate: 0.5 };

  const dataMin = Math.min(...rates);
  const dataMax = Math.max(...rates);
  let span = dataMax - dataMin;

  const minSpan = Math.max(0.25, Math.max(Math.abs(dataMax), Math.abs(dataMin)) * 0.35);
  if (span < minSpan) {
    const mid = (dataMax + dataMin) / 2;
    return { minRate: mid - minSpan / 2, maxRate: mid + minSpan / 2 };
  }

  const padding = Math.max(span * 0.18, 0.08);
  let minRate = dataMin - padding;
  let maxRate = dataMax + padding;

  if (dataMin >= 0) {
    minRate = Math.max(0, dataMin - padding);
  } else if (dataMax <= 0) {
    maxRate = Math.min(0, dataMax + padding);
  } else {
    minRate = Math.min(minRate, 0);
    maxRate = Math.max(maxRate, 0);
  }

  return { minRate, maxRate };
}

export function buildIncomeChart(
  points: IncomeLinePoint[],
  width: number,
  height: number,
  pad: ChartPadding,
): BuiltIncomeChart | null {
  if (points.length === 0) return null;

  const innerH = height - pad.top - pad.bottom;
  const rates = points.map((p) => p.rate);
  const { minRate, maxRate } = computeYDomain(rates);
  const span = maxRate - minRate || 1;

  const rateToY = (rate: number) => pad.top + ((maxRate - rate) / span) * innerH;

  const coords = points.map((point, index) => ({
    x: indexToX(index, points.length, width, pad),
    y: rateToY(point.rate),
    point,
    index,
  }));

  const linePath = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
    .join(' ');

  const crossesZero = minRate < 0 && maxRate > 0;
  const baselineRate = crossesZero ? 0 : minRate;
  const baselineY = rateToY(baselineRate);
  const zeroY = crossesZero ? rateToY(0) : null;

  const lastCoord = coords[coords.length - 1];
  const firstCoord = coords[0];
  const areaPath = `${linePath} L ${lastCoord?.x ?? pad.left} ${baselineY} L ${firstCoord?.x ?? pad.left} ${baselineY} Z`;

  return { coords, linePath, areaPath, minRate, maxRate, baselineY, zeroY };
}

export function pickNearestIndex(
  points: IncomeLinePoint[],
  clientX: number,
  rect: DOMRect,
  width: number,
  pad: ChartPadding,
): number {
  if (points.length === 0) return 0;

  const innerW = rect.width;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / innerW));
  const targetX = pad.left + ratio * (width - pad.left - pad.right);

  let nearest = 0;
  let minDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) {
    const x = indexToX(i, points.length, width, pad);
    const dist = Math.abs(x - targetX);
    if (dist < minDist) {
      minDist = dist;
      nearest = i;
    }
  }
  return nearest;
}

export function lineColor(rate: number): string {
  if (rate > 0) return '#fc4e50';
  if (rate < 0) return '#07b360';
  return '#8b95a8';
}

export function incomeTrendColor(options: {
  todayAmount?: number;
  todayRate?: number;
  fallbackRate?: number;
}): string {
  const { todayAmount, todayRate, fallbackRate = 0 } = options;
  if (todayAmount != null && todayAmount !== 0) return lineColor(todayAmount);
  if (todayRate != null && todayRate !== 0) return lineColor(todayRate);
  return lineColor(fallbackRate);
}
