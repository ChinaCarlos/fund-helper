import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoutOutlined } from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Col,
  Flex,
  Layout,
  Row,
  Spin,
  Typography,
} from 'antd';
import { HoldingsPanel } from '@/components/HoldingsPanel/HoldingsPanel';
import { IndexBar } from '@/components/IndexBar/IndexBar';
import { SummaryCard } from '@/components/SummaryCard/SummaryCard';
import { api } from '@/api/client';
import { useWebSocket } from '@/hooks/useWebSocket';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export function Dashboard() {
  const navigate = useNavigate();
  const [avatarError, setAvatarError] = useState(false);
  const { connected, portfolio, error } = useWebSocket({
    onAuthRequired: () => navigate('/login'),
  });

  useEffect(() => {
    setAvatarError(false);
  }, [portfolio?.user?.avatar]);

  const handleLogout = async () => {
    await api.logout();
    navigate('/login');
  };

  if (!portfolio) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spin
          size="large"
          tip={error ? `加载失败：${error}` : '正在连接实时数据...'}
        />
      </Flex>
    );
  }

  const showAvatar = Boolean(portfolio.user?.avatar && !avatarError);

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Header
        style={{
          background: '#fff',
          color: '#1e293b',
          borderBottom: '1px solid #eef1f6',
          padding: '12px 24px',
          height: 'auto',
          lineHeight: 'normal',
        }}
      >
        <Flex
          align="center"
          justify="space-between"
          gap={16}
          wrap="wrap"
          style={{ width: '100%' }}
        >
          <Flex align="center" gap={12} style={{ minWidth: 0, flex: '1 1 auto' }}>
            {showAvatar ? (
              <Avatar
                size={40}
                src="/api/auth/avatar"
                style={{ flexShrink: 0 }}
                onError={() => {
                  setAvatarError(true);
                  return false;
                }}
              />
            ) : (
              <Avatar size={40} style={{ background: '#fc4e50', flexShrink: 0 }}>
                {portfolio.user?.nickname?.charAt(0) || '基'}
              </Avatar>
            )}
            <div style={{ minWidth: 0 }}>
              <Title level={5} style={{ margin: 0, color: '#1e293b', lineHeight: 1.4 }}>
                养基宝实时监控
              </Title>
              <Text style={{ fontSize: 13, color: '#8b95a8', lineHeight: 1.4 }}>
                {portfolio.user?.nickname || '已登录'}
                {portfolio.trading ? ' · 交易时段' : ' · 非交易时段'}
              </Text>
            </div>
          </Flex>
          <Flex align="center" gap={16} style={{ flexShrink: 0 }}>
            <Badge
              status={connected ? 'success' : 'default'}
              text={<span style={{ color: '#8b95a8' }}>{connected ? '实时连接' : '重连中'}</span>}
            />
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              退出登录
            </Button>
          </Flex>
        </Flex>
      </Header>

      <Content style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 20px 48px' }}>
        {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

        <IndexBar indices={portfolio.indices} />

        <Row gutter={[16, 16]} style={{ margin: '20px 0' }}>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard label="总资产" value={portfolio.total_assets} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard
              label="当日总收益"
              value={portfolio.today_income}
              sub={formatSubRate(portfolio.today_income_rate)}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard
              label="上涨 / 下跌"
              value={portfolio.rise_count - portfolio.fall_count}
              sub={`${portfolio.rise_count} 涨 / ${portfolio.fall_count} 跌`}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SummaryCard
              label="账户数"
              value={portfolio.accounts.length}
              sub={portfolio.accounts.map((a) => a.title).join('、')}
            />
          </Col>
        </Row>

        <HoldingsPanel
          accounts={portfolio.accounts}
          updatedAt={portfolio.updated_at}
          trading={portfolio.trading}
          onAuthRequired={() => navigate('/login')}
        />
      </Content>
    </Layout>
  );
}

function formatSubRate(rate: number) {
  const sign = rate > 0 ? '+' : rate < 0 ? '-' : '';
  return `收益率 ${sign}${Math.abs(rate).toFixed(2)}%`;
}
