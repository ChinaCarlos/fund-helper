import type { CSSProperties } from 'react';

/** 大屏友好：内容区尽量铺满，仅保留适度边距 */
export const PAGE_CONTENT_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: 'none',
  margin: '0 auto',
  padding: '24px 32px 48px',
};

export const PAGE_HEADER_STYLE: CSSProperties = {
  background: '#fff',
  borderBottom: '1px solid #eef1f6',
  padding: '16px 32px',
  height: 'auto',
  lineHeight: 'normal',
};

export const PAGE_HEADER_INNER_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: 'none',
};

export const PAGE_CARD_STYLE: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #eef1f6',
  padding: 20,
};
