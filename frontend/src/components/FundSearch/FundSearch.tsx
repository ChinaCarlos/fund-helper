import { useEffect, useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  List,
  Modal,
  Popover,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { api } from '@/api/client';
import type { AccountItem, SearchFundItem } from '@/types/portfolio';

const { Text } = Typography;

interface FundSearchProps {
  accounts: AccountItem[];
  onAuthRequired?: () => void;
  compact?: boolean;
}

export function FundSearch({
  accounts,
  onAuthRequired,
  compact = false,
}: FundSearchProps) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchFundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<SearchFundItem | null>(null);
  const [addAccountId, setAddAccountId] = useState<number>(
    () => accounts[0]?.account_id ?? 0,
  );
  const [holdShare, setHoldShare] = useState('0.0000');
  const [holdCost, setHoldCost] = useState('0.0000');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!accounts.some((a) => a.account_id === addAccountId)) {
      setAddAccountId(accounts[0]?.account_id ?? 0);
    }
  }, [accounts, addAccountId]);

  useEffect(() => {
    const trimmed = keyword.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setError('');
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.searchFunds(trimmed);
        setResults(data);
        setOpen(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : '搜索失败';
        if (message.includes('未登录') || message.includes('401')) {
          onAuthRequired?.();
          return;
        }
        setError(message);
        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [keyword, onAuthRequired]);

  const openAddModal = (fund: SearchFundItem) => {
    setAdding(fund);
    setAddAccountId(accounts[0]?.account_id ?? 0);
    setHoldShare('0.0000');
    setHoldCost('0.0000');
    setError('');
    setOpen(false);
  };

  const handleAdd = async () => {
    if (!adding || !addAccountId) return;

    setSubmitting(true);
    setError('');
    try {
      await api.addFundHold(addAccountId, [
        {
          fund_id: adding.id,
          fund_code: adding.code,
          hold_share: holdShare,
          hold_cost: holdCost,
          model: 1,
        },
      ]);
      setAdding(null);
      setKeyword('');
      setResults([]);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '添加失败';
      if (message.includes('未登录') || message.includes('401')) {
        onAuthRequired?.();
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resultsContent = (
    <div style={{ width: compact ? 380 : '100%', maxHeight: 360, overflow: 'auto' }}>
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 8 }} /> : null}
      <List
        loading={loading}
        locale={{ emptyText: keyword.trim() ? '未找到匹配的基金' : '请输入关键词' }}
        dataSource={results}
        renderItem={(fund) => (
          <List.Item
            actions={[
              <Button key="add" type="primary" size="small" onClick={() => openAddModal(fund)}>
                添加
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space wrap>
                  <Text strong>{fund.short_name}</Text>
                  {fund.is_hold ? <Tag>已持有</Tag> : null}
                  {fund.is_optional ? <Tag color="blue">自选</Tag> : null}
                </Space>
              }
              description={
                <Space direction="vertical" size={2}>
                  {fund.name && fund.name !== fund.short_name ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {fund.name}
                    </Text>
                  ) : null}
                  <Text type="secondary" className="mono" style={{ fontSize: 12 }}>
                    {fund.code} · ID {fund.id}
                  </Text>
                  {fund.themes && fund.themes.length > 0 ? (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      主题：{fund.themes.join('、')}
                    </Text>
                  ) : null}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  const addModal = (
    <Modal
      title="添加到持仓"
      open={Boolean(adding)}
      onCancel={() => !submitting && setAdding(null)}
      onOk={handleAdd}
      confirmLoading={submitting}
      okText="确认添加"
      destroyOnClose
    >
      {adding ? (
        <Form layout="vertical">
          <Card size="small" style={{ marginBottom: 16, background: '#fafbfc' }}>
            <Text strong>{adding.short_name}</Text>
            <br />
            <Text type="secondary" className="mono">
              {adding.code}
            </Text>
          </Card>
          <Form.Item label="添加到分组">
            <Select
              value={addAccountId}
              onChange={setAddAccountId}
              options={accounts.map((account) => ({
                value: account.account_id,
                label: account.title,
              }))}
            />
          </Form.Item>
          <Form.Item label="持有份额（最多 4 位小数）">
            <Input value={holdShare} onChange={(e) => setHoldShare(e.target.value)} />
          </Form.Item>
          <Form.Item label="持有成本（最多 4 位小数）">
            <Input value={holdCost} onChange={(e) => setHoldCost(e.target.value)} />
          </Form.Item>
          {error ? <Alert type="error" message={error} showIcon /> : null}
        </Form>
      ) : null}
    </Modal>
  );

  if (compact) {
    return (
      <>
        <Popover
          open={open && Boolean(keyword.trim())}
          onOpenChange={setOpen}
          trigger="click"
          placement="bottomRight"
          content={resultsContent}
        >
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索基金代码 / 名称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onFocus={() => keyword.trim() && setOpen(true)}
            style={{ width: 200 }}
          />
        </Popover>
        {addModal}
      </>
    );
  }

  return (
    <Card title="搜索并添加基金" bordered={false}>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="基金代码、名称、拼音或主题，如 161725 / 白酒"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ width: '100%', marginBottom: 12 }}
      />
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        支持基金代码、名称、拼音简写、主题标签搜索。添加时再选择目标分组。
      </Text>
      {resultsContent}
      {addModal}
    </Card>
  );
}
