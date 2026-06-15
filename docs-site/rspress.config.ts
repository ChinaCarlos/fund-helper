import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rspress/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = 'https://github.com/ChinaCarlos/fund-helper';

export default defineConfig({
  root: 'docs',
  base: '/fund-helper/',
  title: 'Fund Helper',
  description: '养基宝基金收益监控 — Web · Chrome · VS Code · Desktop 文档中心',
  icon: '/logo.svg',
  logo: {
    light: '/logo.svg',
    dark: '/logo.svg',
  },
  lang: 'zh',
  globalStyles: path.join(__dirname, 'theme/index.css'),
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: REPO,
      },
    ],
    footer: {
      message: 'MIT Licensed · Fund Helper',
      copyright: 'Copyright © 2026 Fund Helper Contributors',
    },
  },
  markdown: {
    link: {
      checkDeadLinks: false,
    },
  },
});
