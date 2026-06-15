import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Fund Helper · 养基宝持仓',
  version: pkg.version,
  description: '微信扫码登录养基宝，在浏览器工具栏一键查看持仓与当日收益',
  action: {
    default_popup: 'index.html',
    default_title: 'Fund Helper 持仓',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  permissions: ['storage'],
  host_permissions: ['http://browser-plug-api.yangjibao.com/*'],
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
});
