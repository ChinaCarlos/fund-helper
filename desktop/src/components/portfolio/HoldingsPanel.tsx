import { useMemo, useState } from 'react';
import { Card, Col, Empty, Row, Tabs } from 'antd';
import { AccountSummaryCard } from '@/components/portfolio/AccountSummaryCard';
import { FundTable } from '@/components/portfolio/FundTable';
import { IncomeLineChart } from '@/components/portfolio/IncomeLineChart';
import { useIncomeLines } from '@/hooks/useIncomeLines';
import type { AccountItem } from '@/types/portfolio';

const ALL_TAB = 'all';

interface HoldingsPanelProps {
  accounts: AccountItem[];
  updatedAt?: string;
}

export function HoldingsPanel({ accounts, updatedAt }: HoldingsPanelProps) {
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);

  const activeAccount = accounts.find((account) => String(account.account_id) === activeTab);

  const totalTodayIncome = useMemo(
    () => accounts.reduce((sum, account) => sum + account.today_income, 0),
    [accounts],
  );

  const totalTodayIncomeRate = useMemo(() => {
    const totalAssets = accounts.reduce((sum, account) => sum + account.account_assets, 0);
    if (totalAssets <= 0) return 0;
    return (totalTodayIncome / totalAssets) * 100;
  }, [accounts, totalTodayIncome]);

  const accountIds = useMemo(
    () => accounts.map((account) => account.account_id),
    [accounts],
  );

  const { collectLine, linesByAccount, loading, error } = useIncomeLines(accountIds, updatedAt);

  const tabItems = useMemo(
    () => [
      { key: ALL_TAB, label: '全部' },
      ...accounts.map((account) => ({
        key: String(account.account_id),
        label: account.title,
      })),
    ],
    [accounts],
  );

  return (
    <Card bordered={false} styles={{ body: { padding: 0 } }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        tabBarStyle={{ margin: 0, paddingLeft: 16, paddingRight: 16 }}
      />

      <div style={{ padding: '16px 24px 24px' }}>
        {activeTab === ALL_TAB ? (
          <>
            <IncomeLineChart
              points={collectLine?.points ?? []}
              day={collectLine?.day}
              loading={loading}
              error={error}
              todayIncome={totalTodayIncome}
              todayIncomeRate={totalTodayIncomeRate}
              title="全部 · 当日收益曲线"
            />
            {accounts.length === 0 ? (
              <Empty description="暂无账户分组" style={{ marginTop: 24 }} />
            ) : (
              <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                {accounts.map((account) => (
                  <Col key={account.account_id} xs={24} md={12} xl={8}>
                    <AccountSummaryCard
                      account={account}
                      updated={Boolean(updatedAt)}
                      linePoints={linesByAccount[account.account_id]?.points}
                      onClick={() => setActiveTab(String(account.account_id))}
                    />
                  </Col>
                ))}
              </Row>
            )}
          </>
        ) : activeAccount ? (
          <>
            <IncomeLineChart
              key={activeAccount.account_id}
              points={linesByAccount[activeAccount.account_id]?.points ?? []}
              day={linesByAccount[activeAccount.account_id]?.day}
              loading={loading}
              error={error}
              todayIncome={activeAccount.today_income}
              todayIncomeRate={activeAccount.today_income_rate}
              title={`${activeAccount.title} · 当日收益曲线`}
            />
            <div style={{ marginTop: 20 }}>
              <FundTable funds={activeAccount.funds ?? []} updatedAt={updatedAt} embedded />
            </div>
          </>
        ) : (
          <Empty description="未找到该分组" />
        )}
      </div>
    </Card>
  );
}
