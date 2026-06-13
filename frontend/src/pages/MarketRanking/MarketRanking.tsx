import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FallOutlined,
  ReloadOutlined,
  RiseOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Flex,
  Input,
  Layout,
  Popover,
  Radio,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FundCurveModal } from '@/components/FundCurveModal/FundCurveModal';
import { AppHeader } from '@/components/AppHeader/AppHeader';
import { api } from '@/api/client';
import type {
  FundRankItem,
  FundRankOptionsResponse,
  FundRankQuery,
  RankDimension,
  RankOrder,
  RankScope,
} from '@/types/market';
import { formatPercent, trendColor } from '@/utils/format';
import {
  DEFAULT_MARKET_RANK_COLUMN_ORDER,
  DEFAULT_VISIBLE_MARKET_RANK_COLUMNS,
  getMarketRankCellValue,
  isNavMarketRankColumn,
  isPercentMarketRankColumn,
  filterMarketRankColumnsForTrading,
  isRankDimensionColumn,
  isTradingOnlyMarketRankColumn,
  loadMarketRankVisibleColumns,
  MARKET_RANK_COLUMN_LABELS,
  type MarketRankColumnKey,
  saveMarketRankVisibleColumns,
} from '@/utils/marketRankColumns';
import { PAGE_CONTENT_STYLE } from '@/utils/pageLayout';

const { Content } = Layout;
const { Title, Text } = Typography;

const SORT_DIMENSION_TO_COLUMN: Record<RankDimension, MarketRankColumnKey> = {
  day: 'day',
  week1: 'week1',
  month1: 'month1',
  month3: 'month3',
  month6: 'month6',
  year1: 'year1',
  year2: 'year2',
  year3: 'year3',
  estimate_rate: 'estimate_rate',
};

const DEFAULT_QUERY: Required<
  Pick<
    FundRankQuery,
    'dimension' | 'scope' | 'fund_type' | 'board' | 'sector' | 'page' | 'page_size' | 'order'
  >
> = {
  dimension: 'day',
  scope: 'open',
  fund_type: '全部',
  board: '全部',
  sector: '',
  search: '',
  page: 1,
  page_size: 20,
  order: 'desc',
};

function renderCellValue(key: MarketRankColumnKey, value: string | number | null) {
  if (value == null || value === '') return '-';
  if (key === 'rank') {
    const rank = Number(value);
    if (rank <= 3) {
      return <Tag color={rank === 1 ? 'gold' : rank === 2 ? 'default' : 'orange'}>{rank}</Tag>;
    }
    return rank;
  }
  if (key === 'sector' && typeof value === 'string') {
    return value ? <Tag>{value}</Tag> : '-';
  }
  if (key === 'name' && typeof value === 'string') {
    return (
      <Text style={{ color: '#fc4e50', cursor: 'pointer' }}>{value}</Text>
    );
  }
  if (isPercentMarketRankColumn(key) && typeof value === 'number') {
    return (
      <Text style={{ color: trendColor(value), fontWeight: key === 'estimate_rate' ? 600 : 500 }}>
        {formatPercent(value)}
      </Text>
    );
  }
  if (isNavMarketRankColumn(key) && typeof value === 'number') {
    return value.toFixed(4);
  }
  return value;
}

export function MarketRanking() {
  const [options, setOptions] = useState<FundRankOptionsResponse | null>(null);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [items, setItems] = useState<FundRankItem[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    updatedAt: '',
    trading: false,
    page: 1,
    pageSize: 20,
  });
  const [visibleKeys, setVisibleKeys] = useState<MarketRankColumnKey[]>(
    loadMarketRankVisibleColumns,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curveFund, setCurveFund] = useState<{ code: string; name: string } | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const sortColumnKey = SORT_DIMENSION_TO_COLUMN[query.dimension];

  useEffect(() => {
    void api.getMarketRankOptions().then(setOptions).catch(() => {
      setOptions(null);
    });
  }, []);

  const loadRank = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await api.getMarketRank(query);
      setItems(result.items);
      setMeta({
        total: result.total,
        updatedAt: result.updated_at,
        trading: result.trading,
        page: result.page,
        pageSize: result.page_size,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => {
    void loadRank();
  }, [loadRank]);

  const updateQuery = <K extends keyof typeof DEFAULT_QUERY>(
    key: K,
    value: (typeof DEFAULT_QUERY)[K],
    resetPage = true,
  ) => {
    setQuery((prev) => ({
      ...prev,
      [key]: value,
      ...(resetPage ? { page: 1 } : {}),
    }));
  };

  const handleVisibleChange = (checked: MarketRankColumnKey[]) => {
    const ordered = DEFAULT_MARKET_RANK_COLUMN_ORDER.filter((key) => checked.includes(key));
    const next = ordered.length > 0 ? ordered : DEFAULT_VISIBLE_MARKET_RANK_COLUMNS;
    setVisibleKeys(next);
    saveMarketRankVisibleColumns(next);
  };

  const handleResetColumns = () => {
    setVisibleKeys(DEFAULT_VISIBLE_MARKET_RANK_COLUMNS);
    saveMarketRankVisibleColumns(DEFAULT_VISIBLE_MARKET_RANK_COLUMNS);
  };

  const displayKeys = useMemo(
    () => filterMarketRankColumnsForTrading(visibleKeys, meta.trading, sortColumnKey),
    [visibleKeys, meta.trading, sortColumnKey],
  );

  const columns = useMemo<ColumnsType<FundRankItem>>(() => {
    return displayKeys.map((key) => {
      const isSortColumn = key === sortColumnKey;
      const title = MARKET_RANK_COLUMN_LABELS[key];

      const width =
        key === 'rank'
          ? 72
          : key === 'code'
            ? 100
            : key === 'name'
              ? 220
              : key === 'fund_type'
                ? 130
                : key === 'sector' || key === 'tracking_target'
                  ? 140
                  : key === 'nav_date'
                    ? 120
                    : 108;

      return {
        title: isSortColumn ? (
          <Text strong style={{ color: '#fc4e50' }}>
            {title}
          </Text>
        ) : (
          title
        ),
        key,
        dataIndex: key,
        width,
        align:
          key === 'rank'
            ? 'center'
            : isPercentMarketRankColumn(key) || isNavMarketRankColumn(key)
              ? 'right'
              : 'left',
        ellipsis: key === 'name' || key === 'fund_type' || key === 'tracking_target',
        onHeaderCell: () =>
          isSortColumn
            ? {
                style: {
                  background: '#fff5f5',
                },
              }
            : isRankDimensionColumn(key)
              ? {
                  style: {
                    background: '#fafbfc',
                  },
                }
              : {},
        onCell: () =>
          isSortColumn
            ? {
                style: {
                  background: '#fffafa',
                },
              }
            : {},
        render: (_: unknown, record: FundRankItem) =>
          renderCellValue(key, getMarketRankCellValue(record, key)),
      };
    });
  }, [displayKeys, sortColumnKey]);

  const columnConfigContent = (
    <div style={{ width: 300, maxHeight: 480, overflowY: 'auto' }}>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        勾选表格要展示的东财字段；排行维度（含实时估计涨幅）均在列中展示。
      </Text>
      <Checkbox.Group
        value={visibleKeys}
        onChange={(checked) => handleVisibleChange(checked as MarketRankColumnKey[])}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {DEFAULT_MARKET_RANK_COLUMN_ORDER.map((key) => (
          <Checkbox
            key={key}
            value={key}
            disabled={isTradingOnlyMarketRankColumn(key) && !meta.trading}
          >
            {MARKET_RANK_COLUMN_LABELS[key]}
            {isTradingOnlyMarketRankColumn(key) ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {' '}
                · 仅交易时段
              </Text>
            ) : isRankDimensionColumn(key) ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {' '}
                · 排行维度
              </Text>
            ) : null}
          </Checkbox>
        ))}
      </Checkbox.Group>
      <Divider style={{ margin: '10px 0' }} />
      <Button type="link" size="small" onClick={handleResetColumns} style={{ padding: 0 }}>
        恢复默认（展示全部字段）
      </Button>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <AppHeader
        extra={
          <Button
            icon={<ReloadOutlined />}
            loading={refreshing}
            onClick={() => void loadRank(true)}
          >
            刷新
          </Button>
        }
      />

      <Content style={PAGE_CONTENT_STYLE}>
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            市场基金排行
          </Title>
          <Text type="secondary">东财全字段展示 · 排行维度以列呈现</Text>
        </div>
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
              <Text type="secondary">排序依据</Text>
              <Select
                style={{ width: 180 }}
                value={query.dimension}
                options={(options?.dimensions ?? []).map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
                onChange={(value: RankDimension) => updateQuery('dimension', value)}
              />
            </Space>

            <Space direction="vertical" size={4}>
              <Text type="secondary">数据范围</Text>
              <Radio.Group
                value={query.scope}
                onChange={(e) => {
                  const scope = e.target.value as RankScope;
                  setQuery((prev) => ({
                    ...prev,
                    scope,
                    page: 1,
                    fund_type: scope === 'open' ? prev.fund_type : '全部',
                    board: scope === 'index' ? prev.board : '全部',
                  }));
                }}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="open">开放式基金</Radio.Button>
                <Radio.Button value="index">指数板块</Radio.Button>
              </Radio.Group>
            </Space>

            {query.scope === 'open' ? (
              <Space direction="vertical" size={4}>
                <Text type="secondary">基金类型</Text>
                <Select
                  style={{ width: 140 }}
                  value={query.fund_type}
                  options={(options?.fund_types ?? ['全部']).map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) => updateQuery('fund_type', value)}
                />
              </Space>
            ) : (
              <Space direction="vertical" size={4}>
                <Text type="secondary">指数板块</Text>
                <Select
                  style={{ width: 160 }}
                  value={query.board}
                  options={(options?.index_boards ?? ['全部']).map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) => updateQuery('board', value)}
                />
              </Space>
            )}

            <Space direction="vertical" size={4}>
              <Text type="secondary">主题板块</Text>
              <Select
                allowClear
                showSearch
                placeholder="全部板块"
                style={{ width: 160 }}
                value={query.sector || undefined}
                options={(options?.sectors ?? []).map((value) => ({
                  value,
                  label: value,
                }))}
                onChange={(value) => updateQuery('sector', value ?? '')}
              />
            </Space>

            <Space direction="vertical" size={4}>
              <Text type="secondary">搜索</Text>
              <Input.Search
                allowClear
                placeholder="基金代码 / 名称"
                style={{ width: 200 }}
                value={searchInput}
                enterButton={<SearchOutlined />}
                onChange={(e) => setSearchInput(e.target.value)}
                onSearch={(value) => {
                  setSearchInput(value);
                  updateQuery('search', value.trim());
                }}
              />
            </Space>

            <Space direction="vertical" size={4}>
              <Text type="secondary">排序方向</Text>
              <Radio.Group
                value={query.order}
                onChange={(e) => updateQuery('order', e.target.value as RankOrder)}
                optionType="button"
              >
                <Radio.Button value="desc">
                  <RiseOutlined /> 涨幅优先
                </Radio.Button>
                <Radio.Button value="asc">
                  <FallOutlined /> 跌幅优先
                </Radio.Button>
              </Radio.Group>
            </Space>
          </Flex>
        </div>

        {error ? (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Button size="small" onClick={() => void loadRank(true)}>
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
              共 {meta.total} 只基金
              {query.search ? ` · 搜索「${query.search}」` : ''}
              · 当前按「
              {(options?.dimensions ?? []).find((d) => d.value === query.dimension)?.label ??
                query.dimension}
              」排序
              {meta.trading ? ' · 交易时段' : ' · 非交易时段'}
              {meta.updatedAt ? ` · 更新 ${meta.updatedAt}` : ''}
            </Text>
            <Popover
              title="表格列配置"
              trigger="click"
              placement="bottomRight"
              content={columnConfigContent}
            >
              <Button size="small" icon={<SettingOutlined />}>
                列配置
              </Button>
            </Popover>
          </Flex>

          {loading ? (
            <Flex justify="center" style={{ padding: '48px 0' }}>
              <Spin tip="正在拉取东财排行数据..." />
            </Flex>
          ) : (
            <Table<FundRankItem>
              rowKey="code"
              columns={columns}
              dataSource={items}
              size="middle"
              scroll={{ x: Math.max(1200, visibleKeys.length * 108) }}
              onRow={(record) => ({
                onClick: () => setCurveFund({ code: record.code, name: record.name }),
                style: { cursor: 'pointer' },
              })}
              pagination={{
                current: meta.page,
                pageSize: meta.pageSize,
                total: meta.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page, pageSize) => {
                  setQuery((prev) => ({
                    ...prev,
                    page,
                    page_size: pageSize,
                  }));
                },
              }}
            />
          )}
        </div>
      </Content>
      <FundCurveModal
        open={curveFund != null}
        code={curveFund?.code ?? ''}
        name={curveFund?.name ?? ''}
        onClose={() => setCurveFund(null)}
      />
    </Layout>
  );
}
