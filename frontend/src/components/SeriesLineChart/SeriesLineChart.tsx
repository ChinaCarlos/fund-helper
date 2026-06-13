import { useId, useMemo, useState } from 'react';
import { Checkbox, Empty, Flex, Space, Spin, Typography } from 'antd';
import { formatPercent, trendColor } from '@/utils/format';
import {
  alignSeriesToDates,
  buildMultiSeriesChart,
  buildSeriesChart,
  formatCurveXLabel,
  pickNearestSeriesIndex,
  type ChartSeriesConfig,
  type SeriesPoint,
} from '@/utils/heatmap';

const { Text } = Typography;

interface SeriesLineChartProps {
  points: SeriesPoint[];
  compareSeries?: ChartSeriesConfig[];
  loading?: boolean;
  error?: string;
  valueSuffix?: string;
  height?: number;
}

const WIDTH = 760;
const PAD = { top: 16, right: 18, bottom: 30, left: 52 };

const DEFAULT_COMPARE_COLORS: Record<string, string> = {
  sector: '#f59e0b',
  sh_index: '#3b82f6',
  cyb_index: '#8b5cf6',
};

export function SeriesLineChart({
  points,
  compareSeries = [],
  loading = false,
  error = '',
  valueSuffix = '%',
  height = 220,
}: SeriesLineChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const dateLabels = useMemo(() => points.map((point) => point.label), [points]);

  const alignedCompare = useMemo(() => {
    return compareSeries.map((series) => ({
      ...series,
      color: series.color || DEFAULT_COMPARE_COLORS[series.key] || '#64748b',
      points: alignSeriesToDates(series.points, dateLabels),
    }));
  }, [compareSeries, dateLabels]);

  const activeCompare = useMemo(
    () =>
      alignedCompare.filter(
        (series) => visibleKeys[series.key] !== false && series.points.length > 0,
      ),
    [alignedCompare, visibleKeys],
  );

  const chart = useMemo(() => {
    const pools = [points, ...activeCompare.map((series) => series.points)];
    return buildMultiSeriesChart(pools, WIDTH, height, PAD);
  }, [points, activeCompare, height]);

  if (loading) {
    return (
      <Flex justify="center" style={{ padding: 48 }}>
        <Spin tip="曲线加载中..." />
      </Flex>
    );
  }

  if (error || points.length === 0 || !chart) {
    return <Empty description={error || '暂无曲线数据'} />;
  }

  const activeIndex = hoverIndex ?? points.length - 1;
  const activePoint = points[activeIndex];
  const hoverCoord = chart.coords[activeIndex];
  const stroke = trendColor(activePoint.value);
  const yTicks = [chart.maxValue, (chart.maxValue + chart.minValue) / 2, chart.minValue];
  const span = chart.maxValue - chart.minValue || 1;
  const yLabels = yTicks.map((value) => ({
    value,
    y: PAD.top + ((chart.maxValue - value) / span) * (height - PAD.top - PAD.bottom),
  }));
  const xLabelIndexes =
    points.length <= 6
      ? points.map((_, index) => index)
      : [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <div style={{ position: 'relative' }}>
      {compareSeries.length > 0 ? (
        <Flex wrap="wrap" gap={12} style={{ marginBottom: 12 }}>
          <Checkbox checked disabled>
            <Text style={{ color: stroke }}>本基金</Text>
          </Checkbox>
          {alignedCompare.map((series) => (
            <Checkbox
              key={series.key}
              checked={visibleKeys[series.key] !== false}
              onChange={(event) =>
                setVisibleKeys((prev) => ({
                  ...prev,
                  [series.key]: event.target.checked,
                }))
              }
            >
              <Text style={{ color: series.color }}>{series.label}</Text>
            </Checkbox>
          ))}
        </Flex>
      ) : null}

      {hoverIndex != null ? (
        <div
          style={{
            position: 'absolute',
            zIndex: 2,
            pointerEvents: 'none',
            transform: 'translate(-50%, -100%)',
            left: `${(hoverCoord.x / WIDTH) * 100}%`,
            top: `${(hoverCoord.y / height) * 100}%`,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
            minWidth: 120,
          }}
        >
          <div>{activePoint.label}</div>
          <div style={{ color: stroke }}>
            本基金 {activePoint.value.toFixed(2)}
            {valueSuffix}
          </div>
          {activeCompare.map((series) => {
            const value = series.points[activeIndex]?.value;
            if (value == null) return null;
            return (
              <div key={series.key} style={{ color: series.color }}>
                {series.label} {value.toFixed(2)}
                {valueSuffix}
              </div>
            );
          })}
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHoverIndex(pickNearestSeriesIndex(points, event.clientX, rect, WIDTH, PAD));
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {yLabels.map((item) => (
          <line
            key={item.value}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={item.y}
            y2={item.y}
            stroke="#eef1f6"
            strokeWidth="1"
          />
        ))}
        {chart.zeroY != null ? (
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={chart.zeroY}
            y2={chart.zeroY}
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}
        {hoverIndex != null ? (
          <line
            x1={hoverCoord.x}
            x2={hoverCoord.x}
            y1={PAD.top}
            y2={height - PAD.bottom}
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        ) : null}
        {activeCompare.map((series) => {
          const compareChart = buildSeriesChart(
            series.points,
            WIDTH,
            height,
            PAD,
            [chart.minValue, chart.maxValue],
          );
          if (!compareChart) return null;
          return (
            <path
              key={series.key}
              d={compareChart.linePath}
              fill="none"
              stroke={series.color}
              strokeWidth="1.5"
              strokeDasharray={series.dashed ? '5 4' : undefined}
              vectorEffect="non-scaling-stroke"
              opacity="0.9"
            />
          );
        })}
        <path d={chart.areaPath} fill={`url(#series-${uid})`} opacity="0.35" />
        <path
          d={chart.linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
        {hoverIndex != null ? (
          <circle
            cx={hoverCoord.x}
            cy={hoverCoord.y}
            r="4"
            fill={stroke}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {xLabelIndexes.map((index) => {
          const coord = chart.coords[index];
          return (
            <text
              key={points[index].label}
              x={coord.x}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill="#8b95a8"
            >
              {formatCurveXLabel(points[index].label, points.length)}
            </text>
          );
        })}
        {yLabels.map((item) => (
          <text
            key={item.value}
            x={PAD.left - 8}
            y={item.y + 4}
            textAnchor="end"
            fontSize="11"
            fill="#8b95a8"
          >
            {valueSuffix === '%' ? formatPercent(item.value) : item.value.toFixed(2)}
          </text>
        ))}
        <defs>
          <linearGradient id={`series-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <Flex justify="space-between" style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {points[0]?.label} — {points.at(-1)?.label}
        </Text>
        <Space size={16}>
          {activeCompare.map((series) => (
            <Text key={series.key} style={{ fontSize: 12, color: series.color }}>
              {series.label} {series.points.at(-1)?.value?.toFixed(2)}
              {valueSuffix}
            </Text>
          ))}
          <Text strong style={{ color: trendColor(points.at(-1)?.value ?? 0) }}>
            本基金 {points.at(-1)?.value.toFixed(2)}
            {valueSuffix}
          </Text>
        </Space>
      </Flex>
    </div>
  );
}
