import { useId, useMemo, useState } from 'react';
import { Card, Empty, Flex, Spin, Typography } from 'antd';
import type { IncomeLinePoint } from '@/types/portfolio';
import {
  buildIncomeChart,
  getSessionTimeRange,
  getSessionXLabels,
  incomeTrendColor,
  pickNearestIndex,
} from '@/utils/incomeChart';
import { formatPercent, formatSigned, trendColor } from '@/utils/format';

const { Text, Title } = Typography;

interface IncomeLineChartProps {
  points: IncomeLinePoint[];
  title?: string;
  todayIncome?: number;
  todayIncomeRate?: number;
  day?: string;
  loading?: boolean;
  error?: string;
}

const WIDTH = 800;
const HEIGHT = 180;
const PAD = { top: 12, right: 16, bottom: 28, left: 44 };

export function IncomeLineChart({
  points,
  title = '当日收益曲线',
  todayIncome,
  todayIncomeRate,
  day = '',
  loading = false,
  error = '',
}: IncomeLineChartProps) {
  const uid = useId().replace(/:/g, '');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => buildIncomeChart(points, WIDTH, HEIGHT, PAD), [points]);
  const latestRate = points.at(-1)?.rate ?? 0;
  const trendValue =
    todayIncome != null && todayIncome !== 0
      ? todayIncome
      : todayIncomeRate != null && todayIncomeRate !== 0
        ? todayIncomeRate
        : latestRate;

  const activeIndex = hoverIndex ?? (points.length > 0 ? points.length - 1 : 0);
  const activePoint = points[activeIndex];
  const stroke = incomeTrendColor({
    todayAmount: todayIncome,
    todayRate: todayIncomeRate,
    fallbackRate: latestRate,
  });

  if (loading) {
    return (
      <Card bordered={false} styles={{ body: { padding: 40 } }}>
        <Flex justify="center">
          <Spin tip="收益曲线加载中..." />
        </Flex>
      </Card>
    );
  }

  if (error || points.length === 0 || !chart) {
    return (
      <Card bordered={false}>
        <Empty description={error || '暂无收益曲线数据'} />
      </Card>
    );
  }

  const hoverCoord = chart.coords[activeIndex];
  const xLabels = getSessionXLabels(points, WIDTH, PAD);
  const yTicks = [chart.maxRate, (chart.maxRate + chart.minRate) / 2, chart.minRate];
  const span = chart.maxRate - chart.minRate || 1;
  const yLabels = yTicks.map((value) => ({
    value: value.toFixed(2),
    y: PAD.top + ((chart.maxRate - value) / span) * (HEIGHT - PAD.top - PAD.bottom),
  }));
  const lastTime = points.at(-1)?.label ?? '';

  const titleContent =
    todayIncome != null ? (
      <Title level={5} style={{ margin: 0 }}>
        <Text style={{ color: trendColor(todayIncome) }}>{formatSigned(todayIncome)}</Text>
        {' · '}
        {title}
      </Title>
    ) : (
      <Title level={5} style={{ margin: 0 }}>
        {title}
      </Title>
    );

  return (
    <Card bordered={false} styles={{ body: { padding: '16px 20px 12px' } }}>
      <Flex justify="space-between" align="flex-start" style={{ marginBottom: 12 }}>
        <div>
          {titleContent}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {day || '当日'} · 交易时段 {getSessionTimeRange(points)}
            {lastTime ? ` · 最新 ${lastTime}` : ''}
          </Text>
        </div>
        <Text strong style={{ color: trendColor(trendValue) }}>
          最新 {formatPercent(latestRate)}
        </Text>
      </Flex>

      <div style={{ position: 'relative' }}>
        {hoverIndex != null && activePoint ? (
          <div
            style={{
              position: 'absolute',
              zIndex: 2,
              pointerEvents: 'none',
              transform: 'translate(-50%, -100%)',
              left: `${(hoverCoord.x / WIDTH) * 100}%`,
              top: `${(hoverCoord.y / HEIGHT) * 100}%`,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
            }}
          >
            <div>{activePoint.label}</div>
            <div style={{ color: trendColor(activePoint.rate) }}>
              收益率 {formatPercent(activePoint.rate)}
            </div>
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={title}
          style={{ width: '100%', height: 180, display: 'block' }}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setHoverIndex(pickNearestIndex(points, event.clientX, rect, WIDTH, PAD));
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
              y2={HEIGHT - PAD.bottom}
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          ) : null}
          <path d={chart.areaPath} fill={`url(#income-${uid})`} opacity="0.35" />
          <path
            d={chart.linePath}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
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
          {xLabels.map((item) => (
            <text
              key={`${item.anchor}-${item.label}`}
              x={item.x}
              y={HEIGHT - 8}
              textAnchor={item.anchor}
              fontSize="11"
              fill="#8b95a8"
            >
              {item.label}
            </text>
          ))}
          {yLabels.map((item) => (
            <text
              key={item.value}
              x={PAD.left - 8}
              y={item.y + 4}
              textAnchor="end"
              fontSize="11"
              fill="#8b95a8"
            >
              {item.value}%
            </text>
          ))}
          <defs>
            <linearGradient id={`income-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </Card>
  );
}
