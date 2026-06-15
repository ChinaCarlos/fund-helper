# Fund Helper · JetBrains 插件

在 IntelliJ IDEA / WebStorm / PyCharm 等 JetBrains IDE 中查看养基宝基金持仓，功能与 UI 对齐 [VS Code 扩展](../vscode-extension/README.md)。

## 功能

| 功能 | 说明 |
| ---- | ---- |
| 微信扫码登录 | 插件进程调用养基宝 QR 接口；JCEF 渲染二维码 |
| 大盘指数 | 上证、沪深300、深证成指、创业板指 |
| 汇总卡片 | 总资产、当日收益与收益率、涨跌家数 |
| 多账户 Tab | 全部 / 各分组（支付宝、天天基金等） |
| 基金列表 | 当日收益、涨幅、市值、持有收益 |
| 排序 | 预估涨幅 / 当日收益 / 持仓余额 |
| 自动刷新 | 每 10 秒 silent 刷新 |
| 主题适配 | 背景、文字跟随 IDE LaF；涨跌数字固定红涨绿跌 |
| 状态栏 | 右下角显示当日收益，点击打开底部面板 |

## 入口与交互

| 位置 | 操作 | 说明 |
| ---- | ---- | ---- |
| 左侧 Tool Window | View → Tool Windows → **Fund Helper** | 主界面：登录 + 持仓 |
| 状态栏（右下角） | 点击 `Fund Helper` 或收益数字 | 打开底部 **Fund Helper Panel** |
| 底部 Tool Window | 由状态栏点击唤起 | 默认不在工具栏显示；关闭后可再次点击状态栏打开 |
| 菜单 | Tools → Fund Helper | 打开侧边栏；Tools → Fund Helper: 刷新持仓 |

> 与 VS Code 扩展不同：状态栏**不显示**悬浮 tooltip，仅展示收益文字；完整持仓在底部面板查看。

## 环境要求

- **JDK 17+**（`./gradlew` 必需；仅构建 Webview 不需要 Java）
- JetBrains IDE **2024.2+**（build 242+，需支持 **JCEF**）
- Node.js 18+、pnpm（构建 Webview UI）

### 安装 JDK（macOS）

若终端报 `Unable to locate a Java Runtime`，说明本机未装 JDK 或未配置 `JAVA_HOME`：

```bash
# 推荐：Homebrew 安装 OpenJDK 17
HOMEBREW_NO_AUTO_UPDATE=1 brew install openjdk@17

export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

写入 `~/.zshrc` 以便长期生效。若已安装 IntelliJ IDEA，也可使用其内置 JBR：

```bash
export JAVA_HOME="/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
```

## 安装

### 从 GitHub Release 安装（推荐）

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

## 开发

```bash
cd jetbrains-extension

pnpm install
pnpm run build:webview
./gradlew runIde    # 沙箱 IDE（本地需安装 WebStorm/IDEA，或 CI 拉取 IDE 依赖）
```

`build.gradle.kts` 优先使用 `/Applications/WebStorm.app`；不存在或 `CI=true` 时从 Maven 拉取 IntelliJ Community 2024.2.6。

### Webview 热更新

```bash
pnpm run build:webview   # 修改 webview/src 后重新构建
# 在 Sandbox IDE 中重启插件或重载 Tool Window
```

## 项目结构

```
jetbrains-extension/
├── build.gradle.kts              # IntelliJ Platform 插件配置
├── publish 脚本见 ../publish-jetbrains.sh
├── src/main/kotlin/com/fundhelper/
│   ├── yjb/                      # 养基宝 HTTP + MD5 签名
│   ├── portfolio/                # 持仓聚合、nv_info 归一化
│   ├── session/                  # 会话持久化（PersistentState）
│   ├── ui/                       # JCEF 面板、Controller、Tool Window
│   ├── statusbar/                # 状态栏 Widget
│   └── actions/                  # 菜单/命令
├── webview/src/                  # React 19 UI（与 VS Code 扩展同源）
└── src/main/resources/webview/   # Vite 构建产物（JCEF 本地 HTTP 加载）
```

## 打包

**推荐**（版本号自动同步 `versions.json`）：

```bash
# 仓库根目录
./publish-jetbrains.sh --local      # → assets/releases/jetbrains/v{version}/
./publish-jetbrains.sh --release    # 触发 GitHub Actions
./publish-jetbrains.sh --collect    # 下载 CI 产物
```

**手动**（在 `jetbrains-extension/` 目录）：

```bash
pnpm run build:webview
./gradlew buildPlugin
# → build/distributions/fund-helper-jetbrains-0.1.0.zip
```

CI：`.github/workflows/jetbrains-release.yml`，tag 格式 `jetbrains-v*`。

## 与 VS Code 扩展的差异

| 项目 | VS Code | JetBrains |
| ---- | ------- | --------- |
| Host 语言 | TypeScript (Node) | Kotlin |
| UI 容器 | Webview | JCEF Browser |
| 桥接 | `acquireVsCodeApi` | `JBCefJSQuery` + CustomEvent |
| 主题 | VS Code CSS 变量 | LaF 颜色注入 + CSS fallback |
| 涨跌色 | 跟随主题 charts 色 | 固定红 `#e51400` / 绿 `#008000` |
| 状态栏 | 左下角 + 悬浮持仓表格 | 右下角纯文字，点击开底部面板 |
| 底部面板 | Panel WebviewView | Bottom Tool Window（按需显示） |
| 编辑器 Tab | WebviewPanel | 暂未实现 |

## 说明

- 登录态保存在 `fund-helper-session.xml`（应用级 PersistentState）
- 养基宝 HTTP 在 Kotlin 插件进程发起；JCEF 通过 `http://fundhelper/` 加载打包资源，不直连外网
- 需关注公众号「养基宝」并完成小程序注册后方可扫码

## 参考

- [VS Code 扩展 README](../vscode-extension/README.md)
- [TECH.md §19 · VS Code 扩展](../TECH.md#19-vs-code-扩展架构)
- [TECH.md §20 · JetBrains 插件](../TECH.md#20-jetbrains-插件架构)
- [养基宝 API](../API_README.md)
- [发版与下载](../assets/releases/README.md#jetbrains-插件jetbrains-v)
