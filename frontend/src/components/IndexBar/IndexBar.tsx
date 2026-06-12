import { Card, Flex, Typography } from 'antd';
import type { IndexItem } from '@/types/portfolio';
import { formatPercent, trendColor } from '@/utils/format';

const { Text } = Typography;

interface IndexBarProps {
  indices: IndexItem[];
}

export function IndexBar({ indices }: IndexBarProps) {
  if (!indices.length) return null;

  return (
    <Card bordered={false} styles={{ body: { padding: '12px 16px' } }}>
      <Flex wrap="wrap" gap={12}>
        {indices.map((item) => {
          const color = trendColor(item.dir);
          return (
            <Flex
              key={item.code}
              align="center"
              gap={10}
              style={{
                background: '#fafbfc',
                borderRadius: 10,
                padding: '10px 16px',
                minWidth: 200,
                flex: '1 1 200px',
              }}
            >
              <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap', color: '#1e293b' }}>
                {item.name}
              </Text>
              <Text
                className="mono"
                strong
                style={{
                  color,
                  fontSize: 18,
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                }}
              >
                {item.v}
              </Text>
              <Text
                className="mono"
                strong
                style={{ color, fontSize: 16, lineHeight: 1.2 }}
              >
                {formatPercent(item.dir)}
              </Text>
            </Flex>
          );
        })}
      </Flex>
    </Card>
  );
}
