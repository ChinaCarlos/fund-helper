import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api/client';
import { SeriesLineChart } from '@/components/SeriesLineChart/SeriesLineChart';
import type {
  CurveOverlaySeries,
  FundCurveIndicator,
  FundCurveOptionsResponse,
  FundCurveOverlayContext,
  FundCurvePeriod,
  FundCurvePoint,
  FundCurveResponse,
} from '@/types/market';
import type { ChartSeriesConfig, SeriesPoint } from '@/utils/heatmap';
import { formatPercent, trendColor } from '@/utils/format';

const { Text } = Typography;

const SOURCE_LABELS: Record<string, string> = {
  fund_open_fund_info_em: '东财天天基金',
  fund_etf_hist_em: '东财 ETF 行情',
  fund_lof_hist_em: '东财 LOF 行情',
};

interface FundCurveModalProps {
  open: boolean;
  code: string;
  name: string;
  overlayContext?: FundCurveOverlayContext;
  onClose: () => void;
}

export function FundCurveModal({
  open,
  code,
  name,
  overlayContext,
  onClose,
}: FundCurveModalProps) {
  const [options, setOptions] = useState<FundCurveOptionsResponse | null>(null);
  const [indicator, setIndicator] = useState<FundCurveIndicator>('累计收益率走势');
  const [period, setPeriod] = useState<FundCurvePeriod>('1年');
  const [curve, setCurve] = useState<FundCurveResponse | null>(null);
  const [overlays, setOverlays] = useState<CurveOverlaySeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !code) {
      setOptions(null);
      return;
    }
    void api
      .getFundCurveOptions(code)
      .then((result) => {
        setOptions(result);
        setIndicator(result.indicators[0]?.value ?? '累计收益率走势');
      })
      .catch(() => setOptions(null));
  }, [open, code]);

  const loadCurve = useCallback(async () => {
    if (!open || !code) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getFundCurve(code, { indicator, period, name });
      setCurve(result);
    } catch (err) {
      setCurve(null);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [open, code, name, indicator, period]);

  const loadOverlays = useCallback(async () => {
    if (
      !open ||
      !overlayContext?.sectorName ||
      indicator !== '累计收益率走势'
    ) {
      setOverlays([]);
      return;
    }
    setOverlayLoading(true);
    try {
      const result = await api.getCurveOverlays({
        period,
        sector_name: overlayContext.sectorName,
        board_type: overlayContext.boardType,
      });
      setOverlays(result.series);
    } catch {
      setOverlays([]);
    } finally {
      setOverlayLoading(false);
    }
  }, [open, overlayContext, indicator, period]);

  useEffect(() => {
    void loadCurve();
  }, [loadCurve]);

  useEffect(() => {
    void loadOverlays();
  }, [loadOverlays]);

  const points: SeriesPoint[] =
    curve?.points
      .filter((point) => point.value != null)
      .map((point) => ({
        label: point.date,
        value: point.value as number,
      })) ?? [];

  const compareSeries: ChartSeriesConfig[] = useMemo(
    () =>
      overlays.map((series) => ({
        key: series.key,
        label: series.label,
        color: '',
        dashed: series.key !== 'sector',
        points: series.points
          .filter((point) => point.value != null)
          .map((point) => ({
            label: point.date,
            value: point.value as number,
          })),
      })),
    [overlays],
  );

  const tableRows = useMemo(() => {
    if (!curve?.points.length) return [];
    return [...curve.points]
      .filter((point) => point.nav != null || point.change_rate != null)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [curve?.points]);

  const navLabel =
    curve?.kind === 'open' || options?.kind === 'open' ? '单位净值' : '收盘价';

  const tableColumns: ColumnsType<FundCurvePoint> = useMemo(
    () => [
      {
        title: '日期',
        dataIndex: 'date',
        key: 'date',
        width: 120,
      },
      {
        title: navLabel,
        dataIndex: 'nav',
        key: 'nav',
        align: 'right',
        render: (value: number | null) =>
          value == null ? '-' : value.toFixed(4),
      },
      {
        title: '涨跌幅',
        dataIndex: 'change_rate',
        key: 'change_rate',
        align: 'right',
        render: (value: number | null) =>
          value == null ? (
            '-'
          ) : (
            <Text className="mono" style={{ color: trendColor(value), fontWeight: 500 }}>
              {formatPercent(value)}
            </Text>
          ),
      },
    ],
    [navLabel],
  );

  const indicatorOptions =
    options?.indicators ??
    [
      { value: '累计收益率走势' as const, label: '累计收益率' },
      { value: '单位净值走势' as const, label: '单位净值' },
    ];

  const sourceLabel = SOURCE_LABELS[curve?.source_api ?? options?.source_api ?? ''] ?? '东财';

  const valueSuffix =
    indicator === '累计收益率走势'
      ? '%'
      : curve?.kind === 'open' || options?.kind === 'open'
        ? ''
        : '';

  return (
    <Modal
      title={`${name || code} · 收益曲线`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      destroyOnClose
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          value={indicator}
          style={{ width: 180 }}
          options={indicatorOptions}
          onChange={(value: FundCurveIndicator) => setIndicator(value)}
        />
        {indicator === '累计收益率走势' ? (
          <Select
            value={period}
            style={{ width: 120 }}
            options={(options?.periods ?? ['1月', '3月', '6月', '1年', '3年', '5年', '今年来', '成立来']).map(
              (value) => ({
                value,
                label: value,
              }),
            )}
            onChange={(value: FundCurvePeriod) => setPeriod(value)}
          />
        ) : null}
        <Text type="secondary" style={{ fontSize: 12 }}>
          数据来源：{sourceLabel}
          {overlayContext && indicator === '累计收益率走势'
            ? ' · 可叠加板块/大盘/创业板对比'
            : ''}
          {curve?.updated_at ? ` · 更新 ${curve.updated_at}` : ''}
        </Text>
      </Space>
      <SeriesLineChart
        points={points}
        compareSeries={indicator === '累计收益率走势' ? compareSeries : []}
        loading={loading || overlayLoading}
        error={error ?? undefined}
        valueSuffix={valueSuffix}
      />
      {!loading && !error && tableRows.length > 0 ? (
        <Table<FundCurvePoint>
          style={{ marginTop: 20 }}
          rowKey="date"
          size="small"
          columns={tableColumns}
          dataSource={tableRows}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ y: 280 }}
        />
      ) : null}
    </Modal>
  );
}
