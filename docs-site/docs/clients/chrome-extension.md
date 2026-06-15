---
title: Chrome 浏览器插件
---

基于 **[CRXJS](https://crxjs.dev/) + Vite + React 19 + TypeScript** 构建的养基宝持仓 Popup 扩展。与 fund-helper Web 应用共享养基宝 API 与数据归一化逻辑，但**不依赖后端与 MongoDB**，适合个人在浏览器工具栏快速查看持仓。

---

## 功能

| 功能 | 说明 |
|------|------|
| 微信扫码登录 | 直连养基宝 QR 接口，轮询登录态；Token 存 `chrome.storage.local` |
| 大盘指数 | 上证、沪深300、深证成指、创业板指 |
| 汇总卡片 | 总资产、当日收益与收益率、涨跌家数 |
| 多账户 Tab | 全部 / 各分组（支付宝、蛋卷等） |
| 基金列表 | 当日收益、涨幅、市值、持有收益 |
| 排序 | 当日涨幅（交易时段为**预估涨幅**）/ 当日收益 / 持仓余额；点击当前项切换正序 ↑ / 倒序 ↓ |
| 交易时段 | 自动识别 9:30–11:30、13:30–15:00；交易时段显示「预估」标签 |
| 刷新 | 手动刷新 + 状态行显示更新时间 |
| 退出登录 | 清除本地 Token |

### 与 Web 应用对比

| 能力 | Web 应用 | 浏览器插件 |
|------|----------|------------|
| 养基宝登录 | 绑定二维码（需先账号登录） | 独立微信扫码 |
| 持仓查看 | ✅ | ✅ |
| 收益曲线 | ✅ | ❌ |
| 基金增删 | ✅ | ❌ |
| 市场排行 / 热力图 | ✅ | ❌ |
| 通知推送 | ✅ | ❌ |
| 多用户 / 管理员 | ✅ | ❌ |
| 需后端 / MongoDB | ✅ | ❌ |

---

## 浏览器兼容性

| 浏览器 | 支持 |
|--------|------|
| Chrome | ✅ 推荐 |
| Edge | ✅ |
| 360 极速浏览器（Chromium 内核） | ✅ 扩展管理页加载 `dist/` |
| 360 安全浏览器 | ⚠️ 需切换到极速 / Chrome 内核 |
| Firefox | ❌ 未专门适配（需额外 Manifest 配置） |

> Chrome 扩展 Popup 最大高度为 **600px**，插件 UI 已按此限制布局。

---

## 安装（加载已解压扩展）

```bash
cd chrome-extension
pnpm install
pnpm build        # 产物输出到 dist/
```

1. 打开 `chrome://extensions`（Edge：`edge://extensions`）
2. 开启 **开发者模式**
3. **加载已解压的扩展程序** → 选择 `chrome-extension/dist/` 目录
4. 点击工具栏图标打开 Popup

---

## 开发

```bash
cd chrome-extension
pnpm install
pnpm dev          # HMR，产物在 dist/
```

修改代码后 Popup 需**重新打开**才能看到最新界面；扩展会自动热更新。

```bash
pnpm build        # 类型检查 + 生产构建
```

---

## 发版

版本号由仓库根目录 **`versions.json`** 统一管理，发版前无需手动改 `package.json` / `manifest.config.ts`。

```bash
# 查看 / 递增版本
pnpm version:list
pnpm version:bump chrome patch

# 本地打包 zip（或使用统一 CLI）
./publish-chrome.sh --local
# 或: pnpm release:chrome -- --local
# 或: ./publish-extensions.sh

# 触发 GitHub Actions 构建 Release
./publish-chrome.sh --release
```

CI workflow：[`.github/workflows/chrome-release.yml`](https://github.com/ChinaCarlos/fund-helper/blob/main/.github/workflows/chrome-release.yml)  
产物说明：[`assets/releases/README.md`](/developer/release)

---

## 项目结构

```
chrome-extension/
├── manifest.config.ts    # MV3 清单（permissions、host_permissions）
├── vite.config.ts        # CRXJS + React
├── index.html            # Popup 入口
├── public/icons/         # 16 / 48 / 128 图标
└── src/
    ├── App.tsx           # boot → login → portfolio 路由
    ├── main.tsx
    ├── components/
    │   ├── LoginView.tsx       # 扫码登录
    │   ├── PortfolioView.tsx   # 持仓主界面
    │   └── Icons.tsx
    ├── lib/
    │   ├── yjb.ts              # 养基宝 HTTP + MD5 签名
    │   ├── portfolio.ts        # 持仓快照聚合（对齐 backend calculator）
    │   ├── fundSort.ts         # 基金列表排序
    │   ├── storage.ts          # chrome.storage.local
    │   ├── qr-state.ts         # QR state 归一化
    │   └── format.ts           # 金额 / 百分比格式化
    ├── types/portfolio.ts
    └── styles/popup.css        # Popup 布局（400×600）
```

---

## 技术说明

### 数据流

```
Popup 打开
  → loadSession() 读 chrome.storage.local
  → 有 Token：fetchPortfolioSnapshot()
       ├── yjb.getCollect()
       ├── yjb.getIndex()
       └── 各账户 yjb.getFunds()
  → buildPortfolioSnapshot() 归一化
  → PortfolioView 渲染
```

### 签名与 API

- 基址：`http://browser-plug-api.yangjibao.com`
- 签名：`MD5(url_path + token + timestamp + API_SECRET)`，与 `backend/app/yjb/client.py` 一致
- Manifest 声明 `host_permissions` 访问养基宝域名
- API Secret 内置于插件代码，**适合个人使用**，勿公开分发含密钥的构建包

### 登录流程

1. `POST /api/qr/create` 获取 QR URL
2. Canvas 渲染二维码，每 2s 轮询 `GET /api/qr/state`
3. `state === 2` 且返回 `token` → 保存 Session → 进入持仓页
4. Token 401 → 清除 Session → 回到登录页

### UI 布局

- 宽度 400px，高度 600px（Chrome Popup 上限）
- 单一滚动容器（`.view`），避免内外双层滚动
- 涨 `#fc4e50` / 跌 `#07b360`，与 Web 应用视觉一致

---

## 参考

- [crxjs/chrome-extension-tools](https://github.com/crxjs/chrome-extension-tools)
- [TECH.md §17](/developer/architecture#17-浏览器插件架构) — 架构与主项目关系
- [vscode-extension/README.md](/clients/vscode-extension) — VS Code / Cursor 扩展（同源 UI）
- [API_README.md](/developer/yjb-api) — 养基宝上游 API
