import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  FundOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Flex,
  Layout,
  Radio,
  Segmented,
  Space,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import { api } from '@/api/client';
import { SectorFundsModal } from '@/components/SectorFundsModal/SectorFundsModal';
import type {
  FundFlowIndicator,
  HeatmapBoardType,
  HeatmapItem,
  HeatmapKind,
  HeatmapOptionsResponse,
} from '@/types/market';
import {
  heatmapCellStyle,
  heatmapExtents,
  heatmapValue,
  heatmapValueLabel,
} from '@/utils/heatmap';
import { formatPercent } from '@/utils/format';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

function HeatmapTile({
  item,
  kind,
  max,
  min,
  onClick,
}: {
  item: HeatmapItem;
  kind: HeatmapKind;
  max: number;
  min: number;
  onClick?: () => void;
}) {
  const value = heatmapValue(item, kind);
  const style = heatmapCellStyle(value, max, min);

  return (
    <Tooltip
      title={
        <div>
          <div>{item.name}</div>
          <div>
            {kind === 'fund_flow' ? '主力净流入' : '涨跌幅'}：{heatmapValueLabel(item, kind)}
          </div>
          {item.change_rate != null && kind === 'fund_flow' ? (
            <div>涨跌幅：{formatPercent(item.change_rate)}</div>
          ) : null}
          {item.leading_stock ? <div>领涨：{item.leading_stock}</div> : null}
          {item.up_count != null ? (
            <div>
              上涨 {item.up_count} · 下跌 {item.down_count ?? 0}
            </div>
          ) : null}
        </div>
      }
    >
      <div
        onClick={onClick}
        style={{
          ...style,
          borderRadius: 8,
          padding: '10px 8px',
          minHeight: 72,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          cursor: onClick ? 'pointer' : 'default',
          border: '1px solid rgba(255,255,255,0.35)',
        }}
      >
        <Text
          strong
          style={{
            fontSize: 12,
            color: style.color,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.name}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: 600, color: style.color }}>
          {heatmapValueLabel(item, kind)}
        </Text>
      </div>
    </Tooltip>
  );
}

export function MarketHeatmap() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<HeatmapOptionsResponse | null>(null);
  const [kind, setKind] = useState<HeatmapKind>('sector_change');
  const [boardType, setBoardType] = useState<HeatmapBoardType>('industry');
  const [indicator, setIndicator] = useState<FundFlowIndicator>('今日');
  const [items, setItems] = useState<HeatmapItem[]>([]);
  const [meta, setMeta] = useState({ trading: false, updatedAt: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSector, setActiveSector] = useState<HeatmapItem | null>(null);

  useEffect(() => {
    void api.getHeatmapOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  const loadHeatmap = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await api.getHeatmap({ kind, board_type: boardType, indicator });
      setItems(result.items);
      setMeta({ trading: result.trading, updatedAt: result.updated_at });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kind, boardType, indicator]);

  useEffect(() => {
    void loadHeatmap();
  }, [loadHeatmap]);

  const extents = useMemo(() => heatmapExtents(items, kind), [items, kind]);
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = heatmapValue(a, kind) ?? -Infinity;
      const bv = heatmapValue(b, kind) ?? -Infinity;
      return bv - av;
    });
  }, [items, kind]);

  const kindLabel =
    options?.kinds.find((item) => item.value === kind)?.label ?? '板块热力图';
  const boardLabel =
    options?.board_types.find((item) => item.value === boardType)?.label ?? boardType;

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #eef1f6',
          padding: '12px 24px',
          height: 'auto',
          lineHeight: 'normal',
        }}
      >
        <Flex align="center" justify="space-between" gap={16} wrap="wrap">
          <Flex align="center" gap={12}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/market')}>
              返回排行
            </Button>
            <div>
              <Title level={5} style={{ margin: 0 }}>
                <AppstoreOutlined style={{ marginRight: 8, color: '#fc4e50' }} />
                板块热力图
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                东财行业/概念板块 · 涨幅与主力资金流
              </Text>
            </div>
          </Flex>
          <Space>
            <Button onClick={() => navigate('/market')}>基金排行</Button>
            <Button
              icon={<ReloadOutlined />}
              loading={refreshing}
              onClick={() => void loadHeatmap(true)}
            >
              刷新
            </Button>
          </Space>
        </Flex>
      </Header>

      <Content style={{ maxWidth: 1400, width: '100%', margin: '0 auto', padding: '24px 20px 48px' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #eef1f6',
            padding: 20,
            marginBottom: 16,
          }}
        >
          <Flex gap={16} wrap="wrap" align="center">
            <Space direction="vertical" size={4}>
              <Text type="secondary">视图</Text>
              <Segmented
                value={kind}
                options={(options?.kinds ?? [
                  { value: 'sector_change', label: '板块涨幅' },
                  { value: 'fund_flow', label: '资金流向' },
                ]).map((item) => ({ value: item.value, label: item.label }))}
                onChange={(value) => setKind(value as HeatmapKind)}
              />
            </Space>

            <Space direction="vertical" size={4}>
              <Text type="secondary">板块类型</Text>
              <Radio.Group
                value={boardType}
                onChange={(e) => setBoardType(e.target.value as HeatmapBoardType)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="industry">行业</Radio.Button>
                <Radio.Button value="concept">概念</Radio.Button>
              </Radio.Group>
            </Space>

            {kind === 'fund_flow' ? (
              <Space direction="vertical" size={4}>
                <Text type="secondary">统计周期</Text>
                <Radio.Group
                  value={indicator}
                  onChange={(e) => setIndicator(e.target.value as FundFlowIndicator)}
                  optionType="button"
                >
                  {(options?.flow_indicators ?? ['今日', '5日', '10日']).map((value) => (
                    <Radio.Button key={value} value={value}>
                      {value}
                    </Radio.Button>
                  ))}
                </Radio.Group>
              </Space>
            ) : null}
          </Flex>
        </div>

        {error ? (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" onClick={() => void loadHeatmap(true)}>
                重试
              </Button>
            }
          />
        ) : null}

        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #eef1f6',
            padding: 20,
          }}
        >
          <Flex justify="space-between" align="center" style={{ marginBottom: 16 }} wrap="wrap" gap={8}>
            <Text type="secondary">
              {kindLabel} · {boardLabel}
              {kind === 'fund_flow' ? ` · ${indicator}` : ''} · 共 {sortedItems.length} 个板块
              {meta.trading ? ' · 交易时段' : ' · 非交易时段'}
              {meta.updatedAt ? ` · 更新 ${meta.updatedAt}` : ''}
            </Text>
            <Space size={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                点击板块查看关联基金
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <span style={{ color: '#22c55e' }}>■</span> 跌/流出
              </Text>
            </Space>
          </Flex>

          {loading ? (
            <Flex justify="center" style={{ padding: 80 }}>
              <Spin tip="热力图加载中..." />
            </Flex>
          ) : sortedItems.length === 0 ? (
            <Flex vertical align="center" gap={8} style={{ padding: 80 }}>
              <FundOutlined style={{ fontSize: 28, color: '#cbd5e1' }} />
              <Text type="secondary">暂无板块数据</Text>
            </Flex>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))',
                gap: 8,
              }}
            >
              {sortedItems.map((item) => (
                <HeatmapTile
                  key={`${item.code || item.name}`}
                  item={item}
                  kind={kind}
                  max={extents.max}
                  min={extents.min}
                  onClick={() => setActiveSector(item)}
                />
              ))}
            </div>
          )}
        </div>
      </Content>
      <SectorFundsModal
        open={activeSector != null}
        sector={activeSector}
        boardType={boardType}
        onClose={() => setActiveSector(null)}
      />
    </Layout>
  );
}
