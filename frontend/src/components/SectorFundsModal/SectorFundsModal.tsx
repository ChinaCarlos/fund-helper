import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api/client';
import { FundCurveModal } from '@/components/FundCurveModal/FundCurveModal';
import type { FundCurveOverlayContext, FundRankItem, HeatmapItem } from '@/types/market';
import { formatPercent, trendColor } from '@/utils/format';

const { Text } = Typography;

interface SectorFundsModalProps {
  open: boolean;
  sector: HeatmapItem | null;
  boardType: 'industry' | 'concept';
  onClose: () => void;
}

export function SectorFundsModal({
  open,
  sector,
  boardType,
  onClose,
}: SectorFundsModalProps) {
  const [items, setItems] = useState<FundRankItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curveFund, setCurveFund] = useState<{ code: string; name: string } | null>(null);

  const overlayContext = useMemo<FundCurveOverlayContext | undefined>(() => {
    if (!sector?.name) return undefined;
    return { sectorName: sector.name, boardType };
  }, [sector?.name, boardType]);

  const loadFunds = useCallback(async () => {
    if (!open || !sector?.name) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getSectorFunds({
        sector: sector.name,
        board_type: boardType,
        limit: 50,
      });
      setItems(result.items);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [open, sector?.name, boardType]);

  useEffect(() => {
    void loadFunds();
  }, [loadFunds]);

  const columns: ColumnsType<FundRankItem> = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 64,
      align: 'center',
    },
    {
      title: '代码',
      dataIndex: 'code',
      width: 88,
    },
    {
      title: '基金名称',
      dataIndex: 'name',
      ellipsis: true,
      render: (value: string) => (
        <Text style={{ color: '#fc4e50', cursor: 'pointer' }}>{value}</Text>
      ),
    },
    {
      title: '当天涨幅',
      dataIndex: 'day',
      align: 'right',
      width: 100,
      render: (value: number | null) =>
        value == null ? (
          '-'
        ) : (
          <Text style={{ color: trendColor(value), fontWeight: 600 }}>
            {formatPercent(value)}
          </Text>
        ),
    },
    {
      title: '近1月',
      dataIndex: 'month1',
      align: 'right',
      width: 90,
      render: (value: number | null) =>
        value == null ? '-' : (
          <Text style={{ color: trendColor(value) }}>{formatPercent(value)}</Text>
        ),
    },
    {
      title: '近1年',
      dataIndex: 'year1',
      align: 'right',
      width: 90,
      render: (value: number | null) =>
        value == null ? '-' : (
          <Text style={{ color: trendColor(value) }}>{formatPercent(value)}</Text>
        ),
    },
    {
      title: '基金类型',
      dataIndex: 'fund_type',
      width: 120,
      ellipsis: true,
    },
  ];

  return (
    <>
      <Modal
        title={sector ? `${sector.name} · 板块基金 Top 50` : '板块基金'}
        open={open}
        onCancel={onClose}
        footer={null}
        width={980}
        destroyOnClose
      >
        {sector ? (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            按当日涨幅排序 · 名称/跟踪标的匹配「{sector.name}」
            {sector.change_rate != null ? (
              <>
                {' · 板块涨跌 '}
                <Text style={{ color: trendColor(sector.change_rate) }}>
                  {formatPercent(sector.change_rate)}
                </Text>
              </>
            ) : null}
          </Text>
        ) : null}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin tip="板块基金加载中..." />
          </div>
        ) : (
          <Table<FundRankItem>
            rowKey="code"
            size="small"
            columns={columns}
            dataSource={items}
            locale={{ emptyText: error || '暂无匹配基金' }}
            pagination={false}
            scroll={{ y: 420 }}
            onRow={(record) => ({
              onClick: () => setCurveFund({ code: record.code, name: record.name }),
              style: { cursor: 'pointer' },
            })}
          />
        )}
      </Modal>
      <FundCurveModal
        open={curveFund != null}
        code={curveFund?.code ?? ''}
        name={curveFund?.name ?? ''}
        overlayContext={overlayContext}
        onClose={() => setCurveFund(null)}
      />
    </>
  );
}
