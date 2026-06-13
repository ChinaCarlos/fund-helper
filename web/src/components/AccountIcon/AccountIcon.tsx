import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Avatar } from 'antd';

interface AccountIconProps {
  title: string;
}

const ICON_MAP: Array<{ match: RegExp; glyph: string; color: string }> = [
  { match: /支付宝/, glyph: '支', color: '#1677ff' },
  { match: /天天|东方财富/, glyph: '天', color: '#ff6a00' },
  { match: /且慢|蛋卷/, glyph: '蛋', color: '#faad14' },
  { match: /微信/, glyph: '微', color: '#07c160' },
  { match: /银行|招行|工行|建行|农行/, glyph: '银', color: '#64748b' },
];

export function AccountIcon({ title }: AccountIconProps) {
  const preset = ICON_MAP.find((item) => item.match.test(title));
  const glyph = preset?.glyph ?? (title.charAt(0) || '账');
  const color = preset?.color ?? '#8b95a8';

  return (
    <Avatar size={32} style={{ background: color, flexShrink: 0 }}>
      {glyph}
    </Avatar>
  );
}

export function RiseIcon() {
  return <ArrowUpOutlined style={{ color: '#fc4e50', fontSize: 12 }} />;
}

export function FallIcon() {
  return <ArrowDownOutlined style={{ color: '#07b360', fontSize: 12 }} />;
}
