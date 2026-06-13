# Fund Helper · 桌面端

基于 [kitlib/tauri-app-template](https://github.com/kitlib/tauri-app-template)（Tauri v2 + React 19 + TypeScript + Tailwind v4 + shadcn/ui）构建的养基宝持仓桌面客户端。

## 功能

| 功能 | 说明 |
|------|------|
| 微信扫码登录 | Rust 直连养基宝 QR 接口 |
| 持仓查看 | 指数、汇总、多账户 Tab、基金排序 |
| 本地存储 | SQLite（`data.db`）+ 系统密钥链存 Token |
| 系统托盘 | 关闭窗口可最小化到托盘（模板自带） |

**不包含**：市场排行、板块热力图（无 AKShare）。

## 技术架构

```
React UI  ── Tauri invoke（无 HTTP 端口）──▶  Rust 服务
                                              ├── yjb.rs      养基宝 API
                                              ├── portfolio.rs 快照聚合
                                              └── db.rs       SQLite + Keychain
```

数据目录（首次启动自动创建）：

- macOS: `~/Library/Application Support/com.fundhelper.desktop/data.db`
- Windows: `%APPDATA%\com.fundhelper.desktop\data.db`

## 开发

```bash
cd desktop
pnpm install
pnpm tauri:dev
```

## 打包

```bash
pnpm tauri:build
```

产物在 `src-tauri/target/release/bundle/`。

## 与 monorepo 其他端

| 端 | 说明 |
|----|------|
| `web/` + `backend/` | 完整 Web 应用（含市场、通知、多用户） |
| `chrome-extension/` | 浏览器 Popup 轻量持仓 |
| `desktop/` | 单用户桌面客户端（本目录） |

算法对齐：`chrome-extension/src/lib/` 与 `backend/app/yjb/`。
