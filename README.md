# Fund Helper

基于养基宝 `browser-plug-api` 的基金收益实时监控面板（项目名：`fund-helper`）。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12 · FastAPI · httpx |
| 前端 | React 19 · TypeScript · Rsbuild · Ant Design · pnpm |
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
- 前端：http://localhost:3000
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
| `frontend/src/` | 是 |
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
├── frontend/
├── TECH.md
└── API_README.md      # 养基宝上游 API
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
