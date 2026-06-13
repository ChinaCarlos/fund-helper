import { useId, useMemo, useState } from 'react';
import type { IncomeLinePoint } from '@/types/portfolio';
import {
  buildIncomeChart,
  incomeTrendColor,
  pickNearestIndex,
} from '@/utils/incomeChart';
import { formatPercent, trendColor } from '@/lib/format';

interface IncomeSparklineProps {
  points: IncomeLinePoint[];
  todayIncome?: number;
  todayIncomeRate?: number;
}

const WIDTH = 240;
const HEIGHT = 44;
const PAD = { top: 6, right: 4, bottom: 6, left: 4 };

export function IncomeSparkline({
  points,
  todayIncome,
  todayIncomeRate,
}: IncomeSparklineProps) {
  const uid = useId().replace(/:/g, '');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => buildIncomeChart(points, WIDTH, HEIGHT, PAD), [points]);

  if (!chart || points.length < 2) return null;

  const activeIndex = hoverIndex ?? points.length - 1;
  const active = points[activeIndex];
  const latestRate = points.length > 0 ? points[points.length - 1].rate : 0;
  const stroke = incomeTrendColor({
    todayAmount: todayIncome,
    todayRate: todayIncomeRate,
    fallbackRate: latestRate,
  });
  const hoverCoord = chart.coords[activeIndex];

  return (
    <div
      style={{ position: 'relative', marginTop: 4 }}
      onClick={(e) => e.stopPropagation()}
    >
      {hoverIndex != null ? (
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
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
          }}
        >
          <div>{active.label}</div>
          <div style={{ color: trendColor(active.rate) }}>{formatPercent(active.rate)}</div>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 44, display: 'block' }}
        onMouseMove={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setHoverIndex(pickNearestIndex(points, event.clientX, rect, WIDTH, PAD));
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <path d={chart.areaPath} fill={`url(#spark-${uid})`} opacity="0.3" />
        <path
          d={chart.linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {hoverIndex != null ? (
          <circle
            cx={hoverCoord.x}
            cy={hoverCoord.y}
            r="2.5"
            fill={stroke}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <defs>
          <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
