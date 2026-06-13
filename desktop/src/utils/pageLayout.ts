import type { CSSProperties } from 'react';

/** 大屏友好：内容区尽量铺满，仅保留适度边距 */
export const PAGE_CONTENT_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: 'none',
  margin: '0 auto',
  padding: '24px 32px 48px',
};

/** 固定顶栏 + 下方可滚动内容（配合 WindowFrame overflow-hidden） */
export const PAGE_SHELL_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'var(--background)',
};

export const PAGE_SCROLL_CONTENT_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
};

export const PAGE_HEADER_STYLE: CSSProperties = {
  background: 'var(--card-solid)',
  borderBottom: '1px solid var(--border)',
  padding: '16px 32px',
  height: 'auto',
  lineHeight: 'normal',
};

export const PAGE_HEADER_INNER_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: 'none',
};

export const PAGE_CARD_STYLE: CSSProperties = {
  background: 'var(--card-solid)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  padding: 20,
};
