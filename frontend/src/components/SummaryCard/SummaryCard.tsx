import { Card, Statistic, Typography } from 'antd';
import { formatMoney, formatPercent, trendColor } from '@/utils/format';

const { Text } = Typography;

interface SummaryCardProps {
  label: string;
  value: number;
  sub?: string;
  isPercent?: boolean;
}

export function SummaryCard({ label, value, sub, isPercent }: SummaryCardProps) {
  return (
    <Card bordered={false} style={{ height: '100%' }}>
      <Statistic
        title={label}
        value={isPercent ? formatPercent(value) : formatMoney(value)}
        valueStyle={{ color: trendColor(value), fontSize: 24 }}
      />
      {sub ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}
