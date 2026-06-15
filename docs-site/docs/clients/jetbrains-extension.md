---
title: JetBrains 插件
---

**在 JetBrains IDE 里看基金持仓，不用切窗口。**

Fund Helper 将养基宝持仓面板嵌入 IntelliJ IDEA / WebStorm / PyCharm 等 IDE：微信扫码登录后，于左侧 Tool Window、底部面板或状态栏查看大盘指数、总资产、当日收益与各账户基金明细。无需部署 fund-helper 后端，UI 与 [VS Code 扩展](/clients/vscode-extension) 同源。

> 技术实现详见 [TECH.md §20](/developer/architecture#20-jetbrains-插件架构)。

---

## 功能

| 功能 | 说明 |
|------|------|
| 微信扫码登录 | Kotlin 插件进程调用养基宝 QR 接口；JCEF 渲染二维码 |
| 大盘指数 | 上证、沪深300、深证成指、创业板指 |
| 汇总卡片 | 总资产、当日收益与收益率、涨跌家数 |
| 多账户 Tab | 全部 / 各分组（支付宝、天天基金等） |
| 基金列表 | 当日收益、涨幅、市值、持有收益 |
| 排序 | 预估涨幅 / 当日收益 / 持仓余额 |
| 自动刷新 | 每 10 秒 silent 刷新 |
| 主题适配 | 背景、文字跟随 IDE LaF；涨跌数字固定红涨绿跌 |

---

## 入口与交互

| 位置 | 操作 | 说明 |
|------|------|------|
| **左侧 Tool Window** | View → Tool Windows → **Fund Helper** | 主界面：登录 + 持仓 |
| **状态栏（右下角）** | 点击 `Fund Helper` 或收益数字 | 打开底部 **Fund Helper Panel** |
| **底部 Tool Window** | 由状态栏点击唤起 | 默认隐藏；关闭后再次点击状态栏可重新打开 |
| **菜单** | Tools → Fund Helper | 打开侧边栏 / 刷新持仓 |

与 VS Code 扩展的区别：状态栏**无悬浮 tooltip**，仅显示收益文字；完整持仓在底部面板查看。

---

## 安装

### 环境要求

- JetBrains IDE **2024.2+**（build 242+，需支持 **JCEF**）
- 支持 IntelliJ IDEA、WebStorm、PyCharm、GoLand 等

### 从 GitHub Release 安装

<!-- fund-helper:version:plugin-download -->
**插件包下载（v0.1.0）：**

| 来源 | 地址 |
|------|------|
| **GitHub Release（推荐）** | https://github.com/ChinaCarlos/fund-helper/releases/download/jetbrains-v0.1.0/fund-helper-jetbrains-0.1.0.zip |
| **Release 页** | [jetbrains-v0.1.0](https://github.com/ChinaCarlos/fund-helper/releases/tag/jetbrains-v0.1.0) |

安装：**Settings → Plugins → ⚙ → Install Plugin from Disk…** → 选择 `fund-helper-jetbrains-0.1.0.zip`
<!-- /fund-helper:version:plugin-download -->

1. 下载上方 zip
2. **Settings → Plugins → ⚙ → Install Plugin from Disk…**
3. 重启 IDE

---

## 与其他客户端对比

| 能力 | Chrome | VS Code | **JetBrains** | Desktop |
|------|--------|---------|---------------|---------|
| 养基宝登录 | 微信扫码 | 微信扫码 | 微信扫码 | 微信扫码 |
| 持仓查看 | ✅ | ✅ | ✅ | ✅ |
| 编辑器内嵌 | ❌ | ✅ | ✅ | ❌ |
| 状态栏快捷入口 | ❌ | ✅（左下 + tooltip） | ✅（右下，点击开底部面板） | ❌ |
| 收益曲线 | ❌ | ❌ | ❌ | ✅ |
| 通知推送 | ❌ | ❌ | ❌ | ✅ |
| 需后端 | ❌ | ❌ | ❌ | ❌ |

---

## 发版与 CI

版本号由根目录 `versions.json` 统一管理。

```bash
pnpm version:list
node scripts/version.mjs bump jetbrains patch
./publish-jetbrains.sh --local
./publish-jetbrains.sh --release
./publish-jetbrains.sh --collect
```

| 项 | 链接 |
|----|------|
| Workflow | [jetbrains-release.yml](https://github.com/ChinaCarlos/fund-helper/actions/workflows/jetbrains-release.yml) |
| Tag 格式 | `jetbrains-v{version}` |
| 产物 | `fund-helper-jetbrains-{version}.zip` |

详见 [发版与下载 · JetBrains](/developer/release#jetbrains-插件jetbrains-v)。

---

## 开发

```bash
cd jetbrains-extension
pnpm install && pnpm run build:webview
./gradlew runIde
```

完整说明见 [jetbrains-extension/README.md](https://github.com/ChinaCarlos/fund-helper/blob/main/jetbrains-extension/README.md)。

---

## 常见问题

**界面白屏？** 确认 IDE 版本 ≥ 2024.2 且 JCEF 可用；旧版插件若遇 Tool Window 注册错误，请更新到最新 zip。

**底部面板关闭后打不开？** 点击状态栏右下角收益数字（非悬浮 tooltip 区域）；确保使用含底部面板修复的版本。

**本地构建报 Java 错误？** 配置 JDK 17+ 的 `JAVA_HOME`，不要用 IDE 内置 JBR 25 跑 Gradle（Kotlin 编译需 JDK 17）。

更多见 [FAQ · JetBrains](/guide/faq#jetbrains-插件)。
