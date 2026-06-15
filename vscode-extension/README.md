# Fund Helper · VS Code / Cursor 扩展

**在编辑器里看基金持仓，不用切窗口。**

Fund Helper 将养基宝持仓面板嵌入 VS Code / Cursor：微信扫码登录后，于侧边栏、底部 Panel 或状态栏查看大盘指数、总资产、当日收益与各账户基金明细。无需部署 fund-helper 后端或 MongoDB，样式自动适配明暗主题。

> 技术实现详见 [TECH.md §19](../TECH.md#19-vs-code-扩展架构)。

---

## 功能

| 功能 | 说明 |
|------|------|
| 微信扫码登录 | Extension Host 调用养基宝 QR 接口；Webview 渲染二维码并轮询；Token 存 `globalState` |
| 大盘指数 | 上证、沪深300、深证成指、创业板指 |
| 汇总卡片 | 总资产、当日收益与收益率、涨跌家数 |
| 多账户 Tab | 全部 / 各分组（支付宝、天天基金等） |
| 基金列表 | 当日收益、涨幅、市值、持有收益 |
| 排序 | 当日涨幅（交易时段为**预估涨幅**）/ 当日收益 / 持仓余额；正序 ↑ / 倒序 ↓ |
| 交易时段 | 自动识别 9:30–11:30、13:30–15:00；交易时段显示「预估」标签 |
| 刷新 / 退出 | 视图内刷新按钮；清除本地 Token |
| 主题适配 | 背景、文字、涨跌色跟随 VS Code 明暗主题 |

### 与其他客户端对比

| 能力 | Web 应用 | 浏览器插件 | **VS Code 扩展** | 桌面端 |
|------|----------|------------|------------------|--------|
| 养基宝登录 | 绑定二维码 | 微信扫码 | 微信扫码 | 微信扫码 |
| 持仓查看 | ✅ | ✅ | ✅ | ✅ |
| 编辑器内嵌 | ❌ | ❌ | ✅ | ❌ |
| 收益曲线 | ✅ | ❌ | ❌ | ✅ |
| 市场排行 / 热力图 | ✅ | ❌ | ❌ | ❌ |
| 通知推送 | ✅ | ❌ | ❌ | ✅ |
| 需后端 / MongoDB | ✅ | ❌ | ❌ | ❌ |

---

## 入口一览

扩展提供 **四个可视化入口**，均可打开同一套持仓 Webview（侧边栏为主入口，底部 Panel 可并列查看）。

![Fund Helper 扩展入口示意：活动栏图标、状态栏、底部 Panel Tab、编辑器标题栏命令](https://raw.githubusercontent.com/ChinaCarlos/fund-helper/main/vscode-extension/docs/entry-points.png)

| # | 位置 | 操作 | 说明 |
|---|------|------|------|
| ① | **活动栏（左侧）** | 点击柱状图图标 | 打开侧边栏「Fund Helper → 持仓」主视图 |
| ② | **状态栏（左下角）** | 点击 `Fund Helper` 或当日收益 | 跳转到侧边栏持仓视图 |
| ③ | **底部 Panel** | 切换到 **Fund Helper** Tab | 在终端区域上方嵌入持仓面板，可与终端并列 |
| ④ | **编辑器标题栏（右上角）** | 点击图表按钮 / `...` 菜单中的 **Fund Helper** | 打开侧边栏（Cursor 可能将按钮收入 `...` 菜单） |

### 命令面板（补充入口）

`Cmd+Shift+P` / `Ctrl+Shift+P` 可搜索：

| 命令 | 作用 |
|------|------|
| `Fund Helper` | 打开侧边栏持仓（与 ② 相同） |
| `Fund Helper: 打开侧边栏` | 聚焦活动栏视图 |
| `Fund Helper: 打开底部面板` | 显示底部 Panel Tab |
| `Fund Helper: 在编辑器打开持仓` | 在编辑区以 WebviewPanel 打开 |
| `Fund Helper: 刷新持仓` | 重新拉取养基宝数据 |

> **懒加载**：扩展在首次打开视图或执行上述命令时激活，不会在 Cursor 启动时自动占用资源。

---

## 安装

### 按编辑器选择安装方式

| 编辑器 | 安装方式 | 说明 |
|--------|----------|------|
| **VS Code** | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode) | 扩展面板搜索 **Fund Helper** |
| **Cursor** | VSIX 文件 | 见下方下载地址 |
| **Trae** | VSIX 文件 | 见下方下载地址 |
| **CodeBuddy** | VSIX 文件 | 见下方下载地址 |
| **Qoder** | VSIX 文件 | 见下方下载地址 |

> Cursor、Trae、CodeBuddy、Qoder 等基于 VS Code 的 IDE 通常**无法**直接搜索 Microsoft Marketplace，请下载 VSIX 后本地安装。

---

### VS Code：扩展商店安装

扩展页：[Fund Helper · fund-helper-org.fund-helper-vscode](https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode)

1. 打开 VS Code → 扩展面板（`Cmd+Shift+X` / `Ctrl+Shift+X`）
2. 搜索 **Fund Helper**，或精确搜索：`@id:fund-helper-org.fund-helper-vscode`
3. 点击 **Install**

也可 Quick Open（`Cmd+P` / `Ctrl+P`）粘贴：

```
ext install fund-helper-org.fund-helper-vscode
```

---

### Cursor / Trae / CodeBuddy / Qoder：VSIX 安装

<!-- fund-helper:version:vsix-download -->
**VSIX 下载地址（v0.1.2）：**

| 来源 | 地址 |
|------|------|
| **GitHub Release（推荐）** | https://github.com/ChinaCarlos/fund-helper/releases/download/vscode-v0.1.2/fund-helper-vscode-0.1.2.vsix |
| **Release 页** | [vscode-v0.1.2](https://github.com/ChinaCarlos/fund-helper/releases/tag/vscode-v0.1.2) |

**安装步骤：**

1. 打开 [Release vscode-v0.1.2](https://github.com/ChinaCarlos/fund-helper/releases/tag/vscode-v0.1.2) 下载 `fund-helper-vscode-0.1.2.vsix`
<!-- /fund-helper:version:vsix-download -->
2. 打开 Cursor / Trae / CodeBuddy / Qoder
3. `Cmd+Shift+P`（Windows：`Ctrl+Shift+P`）→ **Extensions: Install from VSIX…**
4. 选择刚下载的 `.vsix` 文件
5. **Reload Window** 重载窗口
6. 点击活动栏柱状图图标，或状态栏 **Fund Helper**，微信扫码登录

> 也可在扩展侧边栏右上角 `…` → **Install from VSIX…** 选择同一文件。

---

### 本地调试（开发）

```bash
cd vscode-extension
pnpm install
pnpm run build
```

1. 用 VS Code / Cursor 打开 **`fund-helper` 根目录** 或 **`vscode-extension` 子目录**
2. `Cmd+Shift+D` → 选择 **Fund Helper Extension** → **F5**
3. 在弹出的 **`[Extension Development Host]`** 新窗口中使用

### 方式 D：自行打包 VSIX

```bash
chmod +x publish-vscode.sh
./publish-vscode.sh 0.1.1 --local
# → assets/releases/vscode/v0.1.1/fund-helper-vscode-0.1.1.vsix
```

发版维护者更新版本时，请重新执行 `--local` 并将新 VSIX 提交到 `assets/releases/vscode/v{版本}/`。

---

## 发版与推送

版本号由根目录 **`versions.json`** 统一管理。推荐用统一发版 CLI：

```bash
./publish-extensions.sh              # 交互式菜单（Chrome + VS Code）
pnpm release:vscode -- --release       # 触发 GitHub Actions
pnpm release:vscode -- --local         # 本地 VSIX
pnpm release:vscode -- --marketplace   # 需 VSCE_PAT
```

也可直接使用 [`publish-vscode.sh`](../publish-vscode.sh)（与桌面端 [`publish-desktop.sh`](../publish-desktop.sh) 用法类似）。不传版本号时自动读取 `versions.json`。

| 模式 | 命令 | 说明 |
|------|------|------|
| 本地打包 | `./publish-vscode.sh --local` | 构建 VSIX 到 `assets/releases/vscode/v{版本}/` |
| GitHub Release | `./publish-vscode.sh --release` | 触发 CI，发布到 Releases（tag `vscode-v{版本}`） |
| 下载 CI 产物 | `./publish-vscode.sh --collect` | 需 `gh auth login` |
| VS Code Marketplace | `./publish-vscode.sh --marketplace` | 需 `VSCE_PAT` 环境变量 |

### 方式 1：GitHub Release（推荐，无需 Marketplace 账号）

```bash
pnpm version:bump vscode patch          # 自动递增版本
./publish-vscode.sh --release           # 或 pnpm release:vscode -- --release
# 等待 CI → ./publish-vscode.sh --collect
```

或打 tag：

```bash
git tag -a vscode-v0.1.1 -m "VS Code extension 0.1.1"
git push origin vscode-v0.1.1
```

下载页：[Releases → vscode-v0.1.1](https://github.com/ChinaCarlos/fund-helper/releases/tag/vscode-v0.1.1)  
CI：[Actions → VS Code Extension Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/vscode-release.yml)

用户安装：下载 `.vsix` → **Install from VSIX…**

### 方式 2：VS Code Marketplace（扩展市场搜索安装）

**一次性准备：**

1. 打开 [Visual Studio Marketplace Publisher](https://marketplace.visualstudio.com/manage) — Publisher **`fund-helper-org`**
2. [Azure DevOps](https://dev.azure.com/) → User settings → **Personal access tokens**  
   - 范围勾选 **Marketplace → Manage**  
3. 导出令牌：

```bash
export VSCE_PAT=你的PAT
./publish-vscode.sh 0.1.1 --marketplace
```

上架后扩展页：[marketplace.visualstudio.com · Fund Helper](https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode)

> **VS Code** 可直接搜索安装；**Cursor / Trae / CodeBuddy / Qoder** 请用 VSIX（见 [安装 · VSIX 章节](#cursor--trae--codebuddy--qoder-vsix-安装)）。

> **Open VSX**（VSCodium / Cursor 搜索）如需上架，可额外使用 [ovsx](https://github.com/eclipse/openvsx)；当前脚本未内置，可手动 `ovsx publish` 同一 VSIX。

---

## 开发

```bash
cd vscode-extension
pnpm install
pnpm run build          # extension + webview 一次构建
pnpm run watch          # 监听 Extension Host（另开终端）
pnpm run watch:webview  # 监听 Webview React
```

| 改动范围 | 刷新方式 |
|----------|----------|
| `src/extension.ts`、`yjb.ts`、`portfolio.ts` 等 | `Cmd+Shift+F5` 重载扩展 |
| `src/webview/` React UI | `pnpm run build:webview` → Webview 内 `Cmd+R` |

Webview 内右键 → **Open Webview Developer Tools** 可调试 React 层。

### 调试配置

- 根目录 [`.vscode/launch.json`](../.vscode/launch.json) — 从 monorepo 根 F5
- 子目录 [`vscode-extension/.vscode/launch.json`](./.vscode/launch.json) — 单独打开 `vscode-extension` 时 F5

---

## 项目结构

```
vscode-extension/
├── package.json              # contributes：views、commands、menus
├── esbuild.mjs               # Extension Host 打包 → dist/extension.js
├── vite.webview.config.ts    # Webview React 打包 → dist/webview/
├── media/
│   └── fund-helper.svg       # 活动栏图标（24×24 单色 SVG）
├── docs/
│   └── entry-points.png      # 入口示意图
└── src/
    ├── extension.ts          # activate：注册视图、命令、状态栏
    ├── fundHelperController.ts  # Webview HTML、postMessage 路由
    ├── yjb.ts                # 养基宝 HTTP + MD5 签名
    ├── portfolio.ts          # 持仓快照聚合
    ├── sessionStore.ts       # globalState 会话
    └── webview/              # React 19 前端
        ├── App.tsx
        ├── components/       # LoginView、PortfolioView
        ├── lib/              # format、fundSort、qr-state
        └── styles/panel.css  # --vscode-* 主题变量
```

---

## 技术说明（摘要）

### 数据流

```
用户打开 Webview
  → Webview postMessage { type: 'boot' }
  → Extension Host loadSession() / fetchPortfolioSnapshot()
  → postMessage 回传 session、portfolio
  → PortfolioView 渲染
```

养基宝 HTTP 在 **Extension Host（Node）** 发起：Webview 受 CSP 限制，不能直连 `browser-plug-api.yangjibao.com`。

### 登录

1. Webview 请求 `startLogin` → Host 调用 `yjb.getQrcode()`
2. Webview Canvas 绘制 QR，每 2s 发送 `pollQr`
3. `state === '2'` 且返回 `token` → 保存 Session → 拉取持仓
4. Token 401 → 清除 Session → 回到登录页

### 主题与样式

`panel.css` 将 Chrome 插件硬编码色映射为 VS Code 变量，例如：

- `--bg` → `--vscode-editor-background`
- `--rise` / `--fall` → `--vscode-charts-red` / `--vscode-charts-green`

---

## 说明与限制

- 登录态保存在 `ExtensionContext.globalState`，卸载扩展后清除。
- 需关注公众号「养基宝」并完成小程序注册后方可扫码登录（与浏览器插件相同）。
- API Secret 内置于 Extension Host，**适合个人使用**。
- Cursor 对 `editor/title` 按钮的支持因版本而异，右上角入口可能出现在 `...` 折叠菜单中。

---

## 参考

| 资源 | 链接 |
|------|------|
| 架构详解 | [TECH.md §19](../TECH.md#19-vs-code-扩展架构) |
| 浏览器插件（UI 同源） | [chrome-extension/README.md](../chrome-extension/README.md) |
| 养基宝 API | [API_README.md](../API_README.md) |
| Webview 示例 | [microsoft/vscode-extension-samples · webview-view-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/webview-view-sample) |
| React Webview 模板 | [githubnext/vscode-react-webviews](https://github.com/githubnext/vscode-react-webviews) |
