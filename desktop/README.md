# Fund Helper · 桌面端

基于 Tauri v2 + Rust + React 19 的养基宝持仓**原生桌面客户端**。单用户本地运行，无需 MongoDB 或 fund-helper 后端。

## 下载

| 平台 | 文件 | 链接 |
|------|------|------|
| macOS（Universal） | `.dmg` | [GitHub Releases](https://github.com/ChinaCarlos/fund-helper/releases/latest) |
| Windows（x64） | 安装包 `.exe` | [GitHub Releases](https://github.com/ChinaCarlos/fund-helper/releases/latest) |

## 功能

| 功能 | 说明 |
|------|------|
| 微信扫码登录 | Rust 直连养基宝 QR 接口；Token 存系统密钥链 |
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
                                              ├── db.rs            SQLite + Keychain
                                              └── notify/          通知推送
                                                    ├── push.rs        推送调度
                                                    ├── feishu_app.rs  飞书应用 IM
                                                    ├── feishu_card.rs 互动卡片模板
                                                    ├── scheduler.rs   定时任务（30s tick）
                                                    └── webhook.rs     Webhook 发送
```

### 本地数据

| 项 | 路径 |
|----|------|
| SQLite | macOS: `~/Library/Application Support/com.fundhelper.desktop/data.db` |
| | Windows: `%APPDATA%\com.fundhelper.desktop\data.db` |
| Token | 系统密钥链（Keyring） |

SQLite 表：`notification_config`、`push_schedule`（上次定时推送时间）。

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

### 维护者：双平台发布

在仓库根目录：

```bash
chmod +x publish-desktop.sh

# 本机打当前平台 → assets/releases/v{version}/
./publish-desktop.sh 0.1.0 --local

# GitHub Actions 构建 macOS + Windows 并发布 Release
./publish-desktop.sh 0.1.0 --release

# 从 CI 拉取产物到 assets/releases/
./publish-desktop.sh 0.1.0 --collect
```

CI 工作流：`.github/workflows/desktop-release.yml`（tag 格式 `desktop-v*`）。

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
