import {
  FundOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Flex, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { ThemeToggle } from '@/components/theme-toggle';

const { Header } = Layout;
const { Text } = Typography;

interface DesktopAppHeaderProps {
  nickname: string;
  avatarUrl?: string;
  loading?: boolean;
  activeKey?: 'portfolio' | 'settings';
  onNavigate: (key: 'portfolio' | 'settings') => void;
  onRefresh?: () => void;
  onLogout: () => void;
}

export function DesktopAppHeader({
  nickname,
  avatarUrl,
  loading,
  activeKey = 'portfolio',
  onNavigate,
  onRefresh,
  onLogout,
}: DesktopAppHeaderProps) {
  const navItems: MenuProps['items'] = [
    { key: 'portfolio', icon: <FundOutlined />, label: '持仓' },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '消息通知',
      onClick: () => onNavigate('settings'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => void onLogout(),
    },
  ];

  const letter = nickname?.[0]?.toUpperCase() ?? '基';

  return (
    <Header
      style={{
        flexShrink: 0,
        background: 'var(--card-solid)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: 'auto',
        lineHeight: 'normal',
      }}
    >
      <Flex align="center" justify="space-between" gap={16} style={{ width: '100%', minHeight: 56 }}>
        <Flex align="center" gap={8} style={{ minWidth: 0, flex: '1 1 auto' }}>
          <Text
            strong
            style={{ fontSize: 16, color: 'var(--foreground)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={() => onNavigate('portfolio')}
          >
            Fund Helper
          </Text>
          <Menu
            mode="horizontal"
            selectedKeys={[activeKey === 'settings' ? '' : activeKey]}
            items={navItems}
            onClick={({ key }) => onNavigate(key as 'portfolio')}
            style={{ flex: 1, minWidth: 0, borderBottom: 'none', background: 'transparent', lineHeight: '46px' }}
          />
        </Flex>

        <Flex align="center" gap={12} style={{ flexShrink: 0 }}>
          <ThemeToggle />
          {activeKey === 'portfolio' && onRefresh ? (
            <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
              刷新持仓
            </Button>
          ) : null}
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
            <Flex align="center" gap={8} style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}>
              <Avatar size={32} src={avatarUrl} style={{ background: '#fc4e50', flexShrink: 0 }}>
                {letter}
              </Avatar>
              <Text style={{ maxWidth: 120 }} ellipsis>
                {nickname}
              </Text>
            </Flex>
          </Dropdown>
        </Flex>
      </Flex>
    </Header>
  );
}
