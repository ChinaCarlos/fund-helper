# Fund Helper · 桌面端

基于 Tauri v2 + Rust + React 19 的养基宝持仓**原生桌面客户端**。单用户本地运行，无需 MongoDB 或 fund-helper 后端。

## 下载

> Releases 页在 **首次 CI 成功前为空**。构建完成后在此下载：

| 平台 | 文件 | 链接 |
|------|------|------|
<!-- fund-helper:version:download -->
| macOS（Universal，Apple Silicon + Intel） | `Fund-Helper-0.1.2-macos.dmg` | [Release desktop-v0.1.2](https://github.com/ChinaCarlos/fund-helper/releases/tag/desktop-v0.1.2) |
| Windows | `Fund-Helper-0.1.2-windows-setup.exe` | 同上 |
<!-- /fund-helper:version:download -->

查看构建是否完成：[Actions → Desktop Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml)

## 功能

| 功能 | 说明 |
|------|------|
| 微信扫码登录 | Rust 直连养基宝 QR 接口；登录态存本地 SQLite |
| 持仓查看 | 四大指数、汇总卡片、多账户 Tab、基金排序 |
| 收益曲线 | 汇总 + 分组 SVG 曲线（`income_line_data`） |
| 消息通知 | 钉钉 / 飞书 / 企业微信；Webhook 或飞书应用 IM 互动卡片 |
| 推送策略 | 手动刷新后推送 / 1~60 分钟定时 / 仅交易时段 |
| 飞书应用 | App ID/Secret、投递会话列表、创建专属通知群 |
| 主题 | 浅色 / 深色切换（对齐 Web 色板） |
| 系统托盘 | 关闭窗口可最小化到托盘；单实例 |

**不包含**：市场排行、板块热力图、多用户管理（无 AKShare / MongoDB）。

## 技术架构

```
React UI  ── Tauri invoke（无 HTTP 端口）──▶  Rust
                                              ├── yjb.rs           养基宝 API
                                              ├── portfolio.rs     快照聚合
                                              ├── income.rs        收益曲线
                                              ├── db.rs            SQLite（Token + 配置）
                                              └── notify/          通知推送
                                                    ├── push.rs        推送调度
                                                    ├── feishu_app.rs  飞书应用 IM
                                                    ├── feishu_card.rs 互动卡片模板
                                                    ├── scheduler.rs   定时任务（30s tick）
                                                    └── webhook.rs     Webhook 发送
```

### 本地数据（SQLite）

数据文件 `data.db` 路径：

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/com.fundhelper.desktop/data.db` |
| Windows | `%APPDATA%\com.fundhelper.desktop\data.db` |

| 表 | 内容 |
|----|------|
| `app_profile` | 养基宝 Token（`yjb_token`）、昵称、头像、登录时间 |
| `notification_config` | 通知配置 JSON |
| `push_schedule` | 上次定时推送时间戳 |

登录态与通知凭据**均从 SQLite 读写**，不使用系统钥匙串。

## 环境要求

- Node.js 18+、pnpm 9+
- Rust stable（`rustup`）
- macOS：Xcode Command Line Tools
- Windows：WebView2（Win10+ 通常已预装）

## 开发

```bash
cd desktop
pnpm install
pnpm tauri:dev
```

> 若 1420 端口占用：`lsof -ti:1420 | xargs kill -9` 后重试。  
> 修改 `src-tauri/icons/` 会触发 Rust 重编译，属正常现象。

## 打包

### 本机单平台

```bash
cd desktop
pnpm tauri:build
# 产物: src-tauri/target/release/bundle/
```

### 维护者：双平台发布（GitHub Actions，推荐）

**不在本机构建 Windows 包**；由 CI 在 macOS / Windows runner 上分别打包并发布到 GitHub Releases。

```bash
chmod +x publish-desktop.sh

# 触发 CI 构建 macOS + Windows（需 gh login，或见脚本输出的网页方式）
./publish-desktop.sh 0.1.0 --release

# 构建完成后下载到 assets/releases/
./publish-desktop.sh 0.1.0 --collect
```

或打开 [Actions → Desktop Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml) → **Run workflow**，填写版本号。

CI 工作流：`.github/workflows/desktop-release.yml`

## 与 monorepo 其他端

| 端 | 说明 |
|----|------|
| `web/` + `backend/` | 完整 Web 应用（市场、多用户、MongoDB 通知配置） |
| `chrome-extension/` | 浏览器 Popup 轻量持仓 |
| `desktop/` | 单用户桌面客户端（本目录） |

算法与 Web/插件对齐：`portfolio.rs` ↔ `calculator.py`；通知模板 ↔ `backend/app/notify/template.py`。

## 相关文档

- [根目录 README](../README.md) — 总览与下载
- [assets/releases/README.md](../assets/releases/README.md) — 发布产物说明
- [TECH.md §18](../TECH.md#18-桌面端架构) — 架构细节
