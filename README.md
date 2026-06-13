# Fund Helper

基于养基宝 `browser-plug-api` 的基金收益实时监控面板（项目名：`fund-helper`）。

提供两种使用方式：

| 方式 | 说明 |
|------|------|
| **Web 应用** | 完整功能：持仓、市场排行、板块热力图、通知推送、多用户管理 |
| **浏览器插件** | 轻量 Popup：微信扫码登录养基宝，工具栏一键查看持仓与当日收益（无需后端） |
| **桌面端** | Tauri + Rust：单用户本地 SQLite，扫码登录；持仓、收益曲线、飞书/钉钉/企微通知推送、系统托盘 |

详见 [chrome-extension/README.md](./chrome-extension/README.md) 与 [desktop/README.md](./desktop/README.md)。

## 桌面端下载

> **说明**：安装包由 GitHub Actions 构建并发布到 [Releases](https://github.com/ChinaCarlos/fund-helper/releases)。**首次发布前该页面为空**；需先 [触发构建](#触发桌面端-ci-构建) 并等待 workflow 完成（约 15–25 分钟）。

| 平台 | 文件 | 下载（CI 完成后） |
|------|------|-------------------|
| **macOS** | `Fund-Helper-0.1.0-macos.dmg` | [desktop-v0.1.0 Release](https://github.com/ChinaCarlos/fund-helper/releases/tag/desktop-v0.1.0) |
| **Windows** | `Fund-Helper-0.1.0-windows-setup.exe` | 同上 Release 页 |

构建进度：[Actions → Desktop Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml)

### 触发桌面端 CI 构建

```bash
# 方式 1：打 tag（已推送 desktop-v0.1.0 时会自动触发）
git tag -a desktop-v0.1.0 -m "Desktop 0.1.0"
git push origin desktop-v0.1.0

# 方式 2：网页 Run workflow
# https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml

# 方式 3：脚本（需 gh login）
chmod +x publish-desktop.sh
./publish-desktop.sh 0.1.0 --release
```

构建完成后执行 `./publish-desktop.sh 0.1.0 --collect` 可将产物拉到本地 `assets/releases/`。

详见 [assets/releases/README.md](./assets/releases/README.md)。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12 · FastAPI · httpx |
| 前端 | React 19 · TypeScript · Rsbuild · Ant Design · pnpm（`web/`） |
| 浏览器插件 | CRXJS · Vite · React 19 · TypeScript · Manifest V3 |
| 桌面端 | Tauri v2 · Rust · React 19 · Tailwind v4（`desktop/`） |
| 部署 | Docker · docker compose |

## 环境要求

**本地开发**

- Python 3.11+（推荐 3.12）
- [uv](https://docs.astral.sh/uv/)
- Node.js 18+
- [pnpm](https://pnpm.io/) 9+
- MongoDB 7+（本地 `mongodb://localhost:27017`，或通过 Docker 仅启动 mongo 服务）

**Docker 部署**

- Docker 24+
- docker compose v2+

---

## 部署模式

MongoDB **打包在项目 Docker 配置里**，无需本机单独安装数据库。

| 模式 | 命令 | 应用 | MongoDB | 数据卷 |
|------|------|------|---------|--------|
| **本地开发** | `./dev-infra.sh` + `./start.sh` | 本机 `:8000` + `:3000` | `mongo-dev` → `localhost:27017` | `mongo_dev_data` |
| **Docker 部署** | `docker compose --profile full up -d --build` | 容器 `:8080` | `mongo`（容器网络内） | `mongo_data` |

两套数据**完全隔离**，可同时运行（`:8080` Docker 应用 + `:3000` 本地前端各用各库）。

---

## 快速体验（拉取预构建镜像）

无需本地构建，直接使用 GitHub Container Registry 上的镜像：

```bash
git clone https://github.com/ChinaCarlos/fund-helper.git
cd fund-helper

# 拉取镜像并启动（app + MongoDB）
docker compose --profile full pull
docker compose --profile full up -d

# 查看状态
docker compose --profile full ps
docker compose --profile full logs -f app
```

浏览器打开 http://localhost:8080 ，使用默认管理员账号登录：

| 项 | 默认值 |
|----|--------|
| 用户名 | `admin` |
| 密码 | `123456` |

可通过环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 修改（见 `docker-compose.yml` 或 `.env.docker.example`）。

登录后可访问市场排行等页面；**持仓页需额外绑定养基宝**（微信扫码，见首页提示）。

| 项 | 说明 |
|----|------|
| 应用镜像 | `carloscca/fund-helper:latest` |
| 数据库 | 内置 MongoDB 7，数据卷 `mongo_data` |
| 停止 | `docker compose --profile full down` |
| 清除数据 | `docker compose --profile full down -v` |

> 镜像为公开包时可直接拉取；若仓库设为私有，需先 `docker login`（Docker Hub 用户名 + Access Token）。

### 维护者发布镜像

```bash
chmod +x publish-image.sh
docker login           # Docker Hub 用户名 + Access Token
./publish-image.sh     # 可选指定版本号: ./publish-image.sh v1.0.0
```

---

## Docker 一体部署（本地构建）

若需修改代码后自行构建镜像：

```bash
cd /path/to/fund-helper

docker compose --profile full up -d --build
docker compose --profile full ps
docker compose --profile full logs -f
docker compose --profile full down          # 停止（保留 mongo_data）
docker compose --profile full down -v       # 停止并清除部署库数据
```

访问 http://localhost:8080

- API 与页面由同一容器提供（`SERVE_STATIC=true`）
- MongoDB 数据持久化在 Docker 卷 **`mongo_data`**（与本地开发的 `mongo_dev_data` 隔离）
- 环境变量示例见 [.env.docker.example](./.env.docker.example)

---

## 本地开发（推荐：Docker 只跑 MongoDB）

> 请在系统终端 (Terminal.app / iTerm) 中操作，避免 Cursor 沙箱拦截养基宝 API。

```bash
cd /path/to/fund-helper
chmod +x dev-infra.sh start.sh

# 1. 启动开发 MongoDB（独立数据卷 mongo_dev_data）
./dev-infra.sh

# 2. 本机启动前后端（会自动连 localhost:27017）
./start.sh
```

- 后端：http://localhost:8000
- 前端：http://localhost:3000（`web/`）
- 数据库：容器 `fund-helper-mongo-dev`，卷 `mongo_dev_data`

本地环境变量示例见 [backend/.env.example](./backend/.env.example)（复制为 `backend/.env` 可选）。

### 全新安装

```bash
./reset.sh
./dev-infra.sh
./start.sh
```

### 修改代码后重启

```bash
# Ctrl+C 停止后
./start.sh
```

| 修改位置 | 是否需要重启 |
|----------|--------------|
| `backend/` | 是 |
| `web/src/` | 是 |
| 仅文档 | 否 |

---

## 功能

### 持仓监控（`/`）

- **账号密码登录**（无自助注册）：首次启动自动创建管理员 `admin` / `123456`（可配置）
- 管理员可在「用户管理」添加 / 编辑 / 删除用户
- **养基宝绑定**：持仓数据需微信扫码绑定养基宝；未绑定或 Token 过期时展示绑定二维码
- 多用户隔离：Session Cookie + MongoDB，通知配置按 `user_id` 存储
- 手动刷新拉取养基宝持仓：大盘指数、汇总卡片、多账户 Tab
- 分组收益曲线（SVG 自研图表）、基金搜索 / 添加 / 删除
- 基金表格列可自定义显示

### 市场数据

- **市场排行**（`/market`）：全市场基金多维度排行，列配置、基金收益曲线弹窗
- **板块热力图**（`/market/heatmap`）：行业/概念板块涨幅或资金流向，下钻板块关联基金

### 通知推送（设置页）

- 支持钉钉、飞书、企业微信（Webhook 群机器人或企业应用）
- 触发策略：手动刷新后 / 每 1~60 分钟 / 仅交易时段
- 配置持久化到 MongoDB `notification_configs`（按用户 `user_id`）

### 部署

- 本地开发：前后端分离（`:8000` + `:3000`）
- Docker：单容器 `:8080`，API 与页面同域

### 浏览器插件（`chrome-extension/`）

- **Chrome / Edge / 360 极速（Chromium 内核）**：加载 `dist/` 即可使用
- 微信扫码登录养基宝，登录态保存在 `chrome.storage.local`
- 四大指数、总资产、当日收益、涨跌分布、多账户 Tab
- 基金列表排序：当日涨幅（交易时段为预估涨幅）/ 当日收益 / 持仓余额，支持正序与倒序
- 直连养基宝 API，**不依赖** fund-helper 后端与 MongoDB

安装与开发见 [chrome-extension/README.md](./chrome-extension/README.md)。

### 桌面端（`desktop/`）

- **macOS / Windows** 原生客户端（Tauri v2 + Rust），无需部署后端
- 微信扫码登录养基宝；登录态与通知配置均存本地 SQLite
- 持仓：大盘指数、汇总卡片、多账户 Tab、基金排序、分组收益曲线（SVG）
- **消息通知**：钉钉 / 飞书 / 企业微信（Webhook 或飞书应用 IM 卡片），手动刷新 / 定时推送
- 浅色 / 深色主题、系统托盘、单实例

开发与打包见 [desktop/README.md](./desktop/README.md)；安装包见上文 [桌面端下载](#桌面端下载)。

---

## 目录结构

```
fund-helper/
├── Dockerfile
├── docker-compose.yml      # mongo（开发/部署共用）+ app（一体部署）
├── dev-infra.sh            # 本地开发：仅启动 MongoDB
├── reset.sh
├── start.sh
├── backend/
├── web/                    # Web 应用（React SPA）
├── chrome-extension/       # 浏览器插件（CRXJS + React Popup）
├── desktop/                # 桌面端（Tauri + Rust）
├── assets/releases/        # 桌面端安装包（本地构建输出，见 README）
├── publish-desktop.sh      # 桌面端发包脚本
├── publish-image.sh        # Docker 镜像发布脚本
├── TECH.md
└── API_README.md           # 养基宝上游 API
```

---

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 持仓 Dashboard |
| `/market` | 市场基金排行 |
| `/market/heatmap` | 板块热力图 |
| `/admin/users` | 用户管理（仅管理员） |
| `/login` | 账号密码登录 |

---

## API 速查

### 认证与持仓

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/auth/status` | 登录状态（含 `yjb_bound`） |
| `POST /api/auth/login` | 账号密码登录 |
| `POST /api/auth/yjb/qrcode` | 养基宝绑定二维码 |
| `GET /api/admin/users` | 用户列表（管理员） |
| `GET /api/portfolio` | 持仓快照（需已绑定养基宝） |
| `GET /api/income/line?collect=true` | 汇总收益曲线 |
| `GET /api/funds/search?keyword=` | 搜索基金 |

### 市场数据

| 端点 | 说明 |
|------|------|
| `GET /api/market/rank/options` | 排行筛选项 |
| `GET /api/market/rank` | 市场基金排行 |
| `GET /api/market/heatmap` | 板块热力图 |
| `GET /api/market/fund/{code}/curve` | 基金收益曲线 |
| `GET /api/market/sector/funds` | 板块关联基金 |

### 通知

| 端点 | 说明 |
|------|------|
| `GET /api/notify/config` | 读取通知配置 |
| `PUT /api/notify/config` | 保存通知配置 |
| `POST /api/notify/test` | 连通性测试 |
| `POST /api/notify/push` | 推送持仓收益 |

详见 [TECH.md](./TECH.md)。

---

## 常见问题

### `ServerSelectionTimeoutError: mongo:27017 Name or service not known`

`mongodb://mongo:27017` 仅用于 **Docker 内的 app 容器**。本机 `./start.sh` 请使用 `mongodb://localhost:27017`，并先执行 `./dev-infra.sh`。

### Docker 容器无法启动

检查 `docker compose logs`，常见为环境变量格式问题。`CORS_ORIGINS` 支持逗号分隔。

### `Blocked by sandbox network policy`

请改用系统终端执行 `./start.sh` 或 `docker compose up`。

### 想完全重来

```bash
./reset.sh && ./start.sh
# 或 Docker
docker compose --profile dev --profile full down -v
docker compose --profile full up -d --build
```

### 浏览器插件无法加载或接口失败

- 确认使用 **Chrome / Edge / 360 极速（Chromium 内核）** 加载 `chrome-extension/dist/`
- 开发模式：`cd chrome-extension && pnpm install && pnpm dev`，在扩展管理页选择 `dist/` 目录
- 插件直连养基宝，与 Web 应用后端无关；401 时重新扫码登录即可
- Firefox 暂未专门适配，见 [chrome-extension/README.md](./chrome-extension/README.md#浏览器兼容性)
