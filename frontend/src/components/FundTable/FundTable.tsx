import { useMemo, useState } from 'react';
import { Button, Modal, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api/client';
import type { FundItem } from '@/types/portfolio';
import { formatMoney, formatPercent, formatSigned, trendColor } from '@/utils/format';

const { Text } = Typography;

interface FundTableProps {
  funds: FundItem[];
  updatedAt?: string;
  onAuthRequired?: () => void;
  embedded?: boolean;
}

export function FundTable({
  funds,
  updatedAt,
  onAuthRequired,
  embedded = false,
}: FundTableProps) {
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<FundItem | null>(null);
  const [error, setError] = useState('');

  const handleConfirmRemove = async () => {
    if (!confirming?.account_id) return;

    setRemovingId(confirming.fund_id);
    setError('');
    try {
      await api.removeFundHold(confirming.account_id, [confirming.fund_id]);
      setConfirming(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除失败';
      if (message.includes('未登录') || message.includes('401')) {
        onAuthRequired?.();
        return;
      }
      setError(message);
    } finally {
      setRemovingId(null);
    }
  };

  const columns: ColumnsType<FundItem> = useMemo(() => {
    const cols: ColumnsType<FundItem> = [
      {
        title: '基金',
        key: 'name',
        fixed: 'left',
        width: 180,
        render: (_, fund) => (
          <div>
            <Text strong>{fund.short_name}</Text>
            <br />
            <Text type="secondary" className="mono" style={{ fontSize: 12 }}>
              {fund.code}
            </Text>
            {fund.sector ? (
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                {fund.sector}
              </Text>
            ) : null}
          </div>
        ),
      },
      {
        title: '当日收益',
        key: 'day',
        align: 'right',
        width: 120,
        render: (_, fund) => (
          <div>
            <Text className="mono" style={{ color: trendColor(fund.day_earn) }}>
              {formatSigned(fund.day_earn)}
            </Text>
            <br />
            <Text className="mono" style={{ color: trendColor(fund.day_rate), fontSize: 12 }}>
              {formatPercent(fund.day_rate)}
            </Text>
          </div>
        ),
      },
    ];

    if (!embedded) {
      cols.push({
        title: '账户',
        key: 'account',
        width: 120,
        render: (_, fund) => (
          <div>
            <Text>{fund.account_title || '-'}</Text>
            {fund.account_id ? (
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                ID {fund.account_id}
              </Text>
            ) : null}
          </div>
        ),
      });
    }

    cols.push(
      {
        title: '市值',
        dataIndex: 'money',
        align: 'right',
        width: 100,
        render: (v: number) => <Text className="mono">{formatMoney(v)}</Text>,
      },
      {
        title: '持有份额',
        dataIndex: 'hold_share',
        align: 'right',
        width: 100,
        render: (v: number) => <Text className="mono">{formatMoney(v, 4)}</Text>,
      },
      {
        title: '成本价',
        dataIndex: 'hold_cost',
        align: 'right',
        width: 90,
        render: (v: number) => <Text className="mono">{formatMoney(v, 4)}</Text>,
      },
      {
        title: '持有金额',
        dataIndex: 'hold_sum',
        align: 'right',
        width: 100,
        render: (v: number) => <Text className="mono">{formatMoney(v)}</Text>,
      },
      {
        title: '单位净值',
        key: 'dwjz',
        align: 'right',
        width: 90,
        render: (_, fund) => (
          <Text className="mono">
            {fund.nv_info?.dwjz ? formatMoney(fund.nv_info.dwjz, 4) : '-'}
          </Text>
        ),
      },
      {
        title: '估值净值',
        key: 'gzjz',
        align: 'right',
        width: 90,
        render: (_, fund) => (
          <Text className="mono">
            {fund.nv_info?.gzjz ? formatMoney(fund.nv_info.gzjz, 4) : '-'}
          </Text>
        ),
      },
      {
        title: '估算涨跌',
        key: 'gszzl',
        align: 'right',
        width: 90,
        render: (_, fund) => (
          <Text className="mono" style={{ color: trendColor(fund.nv_info?.gszzl ?? 0) }}>
            {fund.nv_info?.gszzl ? formatPercent(fund.nv_info.gszzl) : '-'}
          </Text>
        ),
      },
      {
        title: '净值涨跌',
        key: 'jzzzl',
        align: 'right',
        width: 90,
        render: (_, fund) => (
          <Text className="mono" style={{ color: trendColor(fund.nv_info?.jzzzl ?? 0) }}>
            {fund.nv_info?.jzzzl ? formatPercent(fund.nv_info.jzzzl) : '-'}
          </Text>
        ),
      },
      {
        title: '持有收益',
        dataIndex: 'hold_earn',
        align: 'right',
        width: 100,
        render: (v: number) => (
          <Text className="mono" style={{ color: trendColor(v) }}>
            {formatSigned(v)}
          </Text>
        ),
      },
      {
        title: '操作',
        key: 'action',
        align: 'center',
        fixed: 'right',
        width: 80,
        render: (_, fund) => (
          <Button
            danger
            size="small"
            loading={removingId === fund.fund_id}
            onClick={() => {
              if (!fund.account_id) {
                setError('缺少账户信息，无法删除');
                return;
              }
              setError('');
              setConfirming(fund);
            }}
          >
            删除
          </Button>
        ),
      },
    );

    return cols;
  }, [embedded, removingId]);

  return (
    <>
      {embedded ? (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          {funds.length} 只{updatedAt ? ` · 更新 ${updatedAt.replace('T', ' ')}` : ''}
        </Text>
      ) : null}

      <Table
        rowKey={(fund) => `${fund.account_id}-${fund.fund_id}`}
        columns={columns}
        dataSource={funds}
        pagination={false}
        scroll={{ x: embedded ? 960 : 1200 }}
        size="small"
        locale={{ emptyText: '该分组暂无持仓基金' }}
      />

      <Modal
        title="确认删除"
        open={Boolean(confirming)}
        onCancel={() => removingId == null && setConfirming(null)}
        onOk={handleConfirmRemove}
        okText="确认删除"
        okButtonProps={{ danger: true, loading: removingId != null }}
        cancelButtonProps={{ disabled: removingId != null }}
      >
        <Text>
          确定从「{confirming?.account_title || '账户'}」删除以下基金吗？此操作不可撤销。
        </Text>
        {confirming ? (
          <div style={{ marginTop: 12, padding: 12, background: '#fafbfc', borderRadius: 8 }}>
            <Text strong>{confirming.short_name}</Text>
            <br />
            <Text type="secondary" className="mono">
              {confirming.code}
            </Text>
          </div>
        ) : null}
        {error ? <Text type="danger" style={{ display: 'block', marginTop: 12 }}>{error}</Text> : null}
      </Modal>
    </>
  );
}
