import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  FundOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Flex, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { api } from '@/api/client';
import { clearNotificationConfigCache } from '@/services/notificationConfig';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { PAGE_HEADER_STYLE } from '@/utils/pageLayout';

const { Header } = Layout;
const { Text } = Typography;

type NavKey = 'portfolio' | 'market' | 'heatmap' | 'settings' | 'admin';

interface AppHeaderProps {
  /** 右侧附加操作，如持仓页刷新按钮 */
  extra?: React.ReactNode;
}

export function AppHeader({ extra }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, isAdmin } = useAuthStatus();

  const activeKey = useMemo((): NavKey => {
    const path = location.pathname;
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/market/heatmap')) return 'heatmap';
    if (path.startsWith('/market')) return 'market';
    return 'portfolio';
  }, [location.pathname]);

  const navItems: MenuProps['items'] = [
    {
      key: 'portfolio',
      icon: <FundOutlined />,
      label: '持仓',
    },
    {
      key: 'market',
      icon: <AppstoreOutlined />,
      label: '市场排行',
    },
    {
      key: 'heatmap',
      label: '板块热力图',
    },
  ];

  const handleNavClick: MenuProps['onClick'] = ({ key }) => {
    switch (key as NavKey) {
      case 'portfolio':
        navigate('/');
        break;
      case 'market':
        navigate('/market');
        break;
      case 'heatmap':
        navigate('/market/heatmap');
        break;
      default:
        break;
    }
  };

  const handleLogout = async () => {
    await api.logout();
    clearNotificationConfigCache();
    navigate('/login', { replace: true });
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/settings?tab=profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '消息通知',
      onClick: () => navigate('/settings?tab=notify'),
    },
    ...(isAdmin
      ? [
          {
            key: 'admin',
            icon: <TeamOutlined />,
            label: '用户管理',
            onClick: () => navigate('/admin/users'),
          } as const,
        ]
      : []),
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => void handleLogout(),
    },
  ];

  const displayName = status?.yjb_nickname || status?.username || '用户';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <Header style={PAGE_HEADER_STYLE}>
      <Flex align="center" justify="space-between" gap={16} style={{ width: '100%' }}>
        <Flex align="center" gap={8} style={{ minWidth: 0, flex: '1 1 auto' }}>
          <Text
            strong
            style={{
              fontSize: 16,
              color: '#1e293b',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginRight: 8,
            }}
            onClick={() => navigate('/')}
          >
            Fund Helper
          </Text>
          <Menu
            mode="horizontal"
            selectedKeys={[activeKey === 'settings' || activeKey === 'admin' ? '' : activeKey]}
            items={navItems}
            onClick={handleNavClick}
            style={{
              flex: 1,
              minWidth: 0,
              borderBottom: 'none',
              background: 'transparent',
              lineHeight: '46px',
            }}
          />
        </Flex>

        <Flex align="center" gap={12} style={{ flexShrink: 0 }}>
          {extra}
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
            <Flex
              align="center"
              gap={8}
              style={{
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 8,
                transition: 'background 0.15s',
              }}
              className="app-header-user"
            >
              <Avatar
                size={32}
                src={status?.yjb_bound ? '/api/auth/avatar' : undefined}
                style={{ background: '#fc4e50', flexShrink: 0 }}
              >
                {avatarLetter}
              </Avatar>
              <Text style={{ maxWidth: 120 }} ellipsis>
                {status?.username || displayName}
              </Text>
            </Flex>
          </Dropdown>
        </Flex>
      </Flex>
    </Header>
  );
}
