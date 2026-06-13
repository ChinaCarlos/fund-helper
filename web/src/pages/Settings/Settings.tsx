import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BellOutlined, UserOutlined } from '@ant-design/icons';
import { Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { AppHeader } from '@/components/AppHeader/AppHeader';
import { NotificationSettingsPanel } from '@/components/SettingsModal/SettingsModal';
import { ProfileSettingsPanel } from '@/pages/Settings/ProfileSettingsPanel';
import { PAGE_CARD_STYLE, PAGE_CONTENT_STYLE } from '@/utils/pageLayout';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

type SettingsTab = 'profile' | 'notify';

export function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as SettingsTab) || 'profile';

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      { key: 'profile', icon: <UserOutlined />, label: '个人中心' },
      { key: 'notify', icon: <BellOutlined />, label: '消息通知' },
    ],
    [],
  );

  useEffect(() => {
    if (tab !== 'profile' && tab !== 'notify') {
      navigate('/settings?tab=profile', { replace: true });
    }
  }, [tab, navigate]);

  const handleTabChange: MenuProps['onClick'] = ({ key }) => {
    setSearchParams({ tab: key });
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <AppHeader />
      <Content style={PAGE_CONTENT_STYLE}>
        <div style={{ marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0 }}>
            设置
          </Title>
          <Text type="secondary">管理账号与消息推送配置</Text>
        </div>

        <Layout hasSider style={{ background: 'transparent' }}>
          <Sider
            width={200}
            theme="light"
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #eef1f6',
              padding: '8px 0',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[tab]}
              items={menuItems}
              onClick={handleTabChange}
              style={{ border: 'none', background: 'transparent' }}
            />
          </Sider>

          <Content style={{ minWidth: 0 }}>
            {tab === 'profile' ? (
              <ProfileSettingsPanel />
            ) : (
              <div style={PAGE_CARD_STYLE}>
                <Title level={5} style={{ marginTop: 0 }}>
                  消息通知
                </Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  配置持仓推送渠道与触发策略，保存后本地与服务端同步。
                </Text>
                <NotificationSettingsPanel />
              </div>
            )}
          </Content>
        </Layout>
      </Content>
    </Layout>
  );
}
