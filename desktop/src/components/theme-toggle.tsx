import { DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useTheme } from '@/components/theme-provider';

const THEME_LABELS = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
} as const;

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const items: MenuProps['items'] = [
    {
      key: 'light',
      icon: <SunOutlined />,
      label: THEME_LABELS.light,
      onClick: () => setTheme('light'),
    },
    {
      key: 'dark',
      icon: <MoonOutlined />,
      label: THEME_LABELS.dark,
      onClick: () => setTheme('dark'),
    },
    {
      key: 'system',
      icon: <DesktopOutlined />,
      label: THEME_LABELS.system,
      onClick: () => setTheme('system'),
    },
  ];

  return (
    <Dropdown menu={{ items, selectedKeys: [theme] }} trigger={['click']} placement="bottomRight">
      <Button
        type="text"
        icon={resolvedTheme === 'dark' ? <MoonOutlined /> : <SunOutlined />}
        aria-label="切换主题"
        title={`主题：${THEME_LABELS[theme]}`}
      />
    </Dropdown>
  );
}
