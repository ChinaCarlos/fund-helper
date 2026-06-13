import { useCallback, useEffect, useState } from 'react';
import { Alert, Col, Layout, Row, Spin, Typography } from 'antd';
import { DesktopAppHeader } from '@/components/portfolio/DesktopAppHeader';
import { HoldingsPanel } from '@/components/portfolio/HoldingsPanel';
import { IndexBar } from '@/components/portfolio/IndexBar';
import { SummaryCard } from '@/components/portfolio/SummaryCard';
import { api, isUnauthorized } from '@/lib/tauri-api';
import { tryPushAfterRefresh } from '@/utils/notificationPush';
import { PAGE_CONTENT_STYLE, PAGE_SCROLL_CONTENT_STYLE, PAGE_SHELL_STYLE } from '@/utils/pageLayout';
import type { AuthStatus, PortfolioSnapshot } from '@/types/portfolio';

const { Content } = Layout;
const { Text } = Typography;

interface PortfolioPageProps {
  auth: AuthStatus;
  onLogout: () => void;
  onOpenSettings: () => void;
}

function formatSubRate(rate: number): string {
  const sign = rate > 0 ? '+' : rate < 0 ? '-' : '';
  return `收益率 ${sign}${Math.abs(rate).toFixed(2)}%`;
}

export function PortfolioPage({ auth, onLogout, onOpenSettings }: PortfolioPageProps) {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.fetchPortfolio();
      setSnapshot(data);
      void tryPushAfterRefresh();
    } catch (err) {
      if (isUnauthorized(err)) {
        onLogout();
        return;
      }
      setError(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : '加载失败',
      );
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const handleLogout = async () => {
    await api.logout();
    onLogout();
  };

  const avatarUrl = auth.avatar?.replace(/^http:\/\//, 'https://');
  const updatedLabel = snapshot?.updated_at?.replace('T', ' ') ?? '';

  if (loading && !snapshot) {
    return (
      <Layout style={PAGE_SHELL_STYLE}>
        <DesktopAppHeader
          nickname={auth.nickname || '养基宝用户'}
          avatarUrl={avatarUrl}
          loading={loading}
          onNavigate={(key) => key === 'settings' && onOpenSettings()}
          onRefresh={() => void loadPortfolio()}
          onLogout={() => void handleLogout()}
        />
        <Content style={{ ...PAGE_SCROLL_CONTENT_STYLE, ...PAGE_CONTENT_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" tip="正在加载持仓…" />
        </Content>
      </Layout>
    );
  }

  if (!snapshot) {
    return (
      <Layout style={PAGE_SHELL_STYLE}>
        <DesktopAppHeader
          nickname={auth.nickname || '养基宝用户'}
          avatarUrl={avatarUrl}
          onNavigate={(key) => key === 'settings' && onOpenSettings()}
          onRefresh={() => void loadPortfolio()}
          onLogout={() => void handleLogout()}
        />
        <Content style={{ ...PAGE_SCROLL_CONTENT_STYLE, ...PAGE_CONTENT_STYLE }}>
          <Alert type="error" message={error || '加载失败'} showIcon action={<a onClick={() => void loadPortfolio()}>重试</a>} />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={PAGE_SHELL_STYLE}>
      <DesktopAppHeader
        nickname={auth.nickname || '养基宝用户'}
        avatarUrl={avatarUrl}
        loading={loading}
        onNavigate={(key) => key === 'settings' && onOpenSettings()}
        onRefresh={() => void loadPortfolio()}
        onLogout={() => void handleLogout()}
      />

      <Content style={{ ...PAGE_SCROLL_CONTENT_STYLE, ...PAGE_CONTENT_STYLE, padding: '24px 32px 48px' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          {auth.nickname || '养基宝用户'}
          {snapshot.trading ? ' · 交易时段' : ' · 非交易时段'}
          {updatedLabel ? ` · 更新 ${updatedLabel}` : ''}
        </Text>

        {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

        <IndexBar indices={snapshot.indices} />

        <Row gutter={[16, 16]} style={{ margin: '20px 0' }}>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard label="总资产" value={snapshot.total_assets} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard
              label="当日总收益"
              value={snapshot.today_income}
              sub={formatSubRate(snapshot.today_income_rate)}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard
              label="上涨 / 下跌"
              value={snapshot.rise_count - snapshot.fall_count}
              sub={`${snapshot.rise_count} 涨 / ${snapshot.fall_count} 跌`}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard
              label="账户数"
              value={snapshot.accounts.length}
              sub={snapshot.accounts.map((a) => a.title).join('、') || '—'}
            />
          </Col>
        </Row>

        <HoldingsPanel accounts={snapshot.accounts} updatedAt={snapshot.updated_at} />
      </Content>
    </Layout>
  );
}
