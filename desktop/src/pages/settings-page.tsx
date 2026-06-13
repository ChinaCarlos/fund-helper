import { useState } from 'react';
import { BellOutlined, BgColorsOutlined } from '@ant-design/icons';
import { Button, Flex, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { DesktopAppHeader } from '@/components/portfolio/DesktopAppHeader';
import { NotificationSettingsPanel } from '@/components/settings/NotificationSettingsPanel';
import { useTheme } from '@/components/theme-provider';
import { PAGE_CARD_STYLE, PAGE_CONTENT_STYLE, PAGE_SCROLL_CONTENT_STYLE, PAGE_SHELL_STYLE } from '@/utils/pageLayout';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

type SettingsSection = 'appearance' | 'notify';

interface SettingsPageProps {
  nickname: string;
  avatarUrl?: string;
  onBack: () => void;
  onLogout: () => void;
}

export function SettingsPage({ nickname, avatarUrl, onBack, onLogout }: SettingsPageProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const menuTheme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const menuItems: MenuProps['items'] = [
    { key: 'appearance', icon: <BgColorsOutlined />, label: '外观' },
    { key: 'notify', icon: <BellOutlined />, label: '消息通知' },
  ];

  const [activeSection, setActiveSection] = useState<SettingsSection>('notify');

  return (
    <Layout style={PAGE_SHELL_STYLE}>
      <DesktopAppHeader
        nickname={nickname}
        avatarUrl={avatarUrl}
        activeKey="settings"
        onNavigate={(key) => key === 'portfolio' && onBack()}
        onLogout={onLogout}
      />

      <Content style={{ ...PAGE_SCROLL_CONTENT_STYLE, ...PAGE_CONTENT_STYLE }}>
        <div style={{ marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0 }}>
            设置
          </Title>
          <Text type="secondary">外观与消息推送配置</Text>
        </div>

        <Layout hasSider style={{ background: 'transparent' }}>
          <Sider
            width={200}
            theme={menuTheme}
            style={{
              background: 'var(--card-solid)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              padding: '8px 0',
            }}
          >
            <Menu
              mode="inline"
              theme={menuTheme}
              selectedKeys={[activeSection]}
              items={menuItems}
              onClick={({ key }) => setActiveSection(key as SettingsSection)}
              style={{ border: 'none', background: 'transparent' }}
            />
          </Sider>

          <Content style={{ minWidth: 0 }}>
            {activeSection === 'appearance' ? (
              <div style={PAGE_CARD_STYLE}>
                <Title level={5} style={{ marginTop: 0 }}>
                  外观
                </Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  选择浅色、深色或跟随系统主题。
                </Text>
                <Flex gap={8} wrap="wrap">
                  <Button
                    type={theme === 'light' ? 'primary' : 'default'}
                    onClick={() => setTheme('light')}
                  >
                    浅色
                  </Button>
                  <Button
                    type={theme === 'dark' ? 'primary' : 'default'}
                    onClick={() => setTheme('dark')}
                  >
                    深色
                  </Button>
                  <Button
                    type={theme === 'system' ? 'primary' : 'default'}
                    onClick={() => setTheme('system')}
                  >
                    跟随系统
                  </Button>
                </Flex>
              </div>
            ) : (
              <div style={PAGE_CARD_STYLE}>
                <Title level={5} style={{ marginTop: 0 }}>
                  消息通知
                </Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  配置保存在 SQLite；后台任务按触发频率通过 Webhook 推送持仓收益（仅群机器人）。
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
