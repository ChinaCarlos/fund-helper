# 养基宝实时监控 (YJB Realtime)

基于养基宝 browser-plug-api 的基金收益实时监控面板。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11+ · FastAPI · httpx · uv |
| 前端 | React 19 · TypeScript · Rsbuild · Ant Design · pnpm |

## 环境要求

- Python 3.11+（或 3.9+）
- [uv](https://docs.astral.sh/uv/) — Python 包管理
- Node.js 18+
- [pnpm](https://pnpm.io/) 9+

安装 uv：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

安装 pnpm（任选其一）：

```bash
corepack enable && corepack prepare pnpm@latest --activate
# 或
npm install -g pnpm
```

---

## 全新安装（从零开始）

> **请在系统终端 (Terminal.app / iTerm) 中操作**，不要在 Cursor 内置沙箱终端启动后端，否则无法访问养基宝 API。

### 1. 清除所有数据与依赖

```bash
cd /path/to/yjb-realtime
chmod +x reset.sh start.sh
./reset.sh
```

会删除：

- `data/*.json`（登录 Token 等）
- `backend/.venv`（Python 虚拟环境）
- `frontend/node_modules`、`frontend/dist`、`package-lock.json`（若存在）

### 2. 启动项目

```bash
./start.sh
```

首次启动会自动：

- `uv venv` + `uv pip install` 安装后端依赖
- `pnpm install` 安装前端依赖
- 启动后端 `:8000` 与前端 `:3000`

浏览器打开 http://localhost:3000 ，使用微信扫码重新登录。

### 3. 分别启动（可选）

```bash
./start.sh backend   # 仅后端
./start.sh frontend  # 仅前端（需后端已运行）
```

手动启动等价命令：

```bash
# 后端
cd backend
uv venv && uv pip install -r requirements.txt
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# 前端
cd frontend
pnpm install
pnpm dev
```

---

## 修改代码后如何重启

**每次修改代码后，请先停止服务再重新启动**（避免旧进程缓存导致行为不一致）：

1. 在运行 `./start.sh` 的终端按 **Ctrl+C** 停止
2. 重新执行：

```bash
./start.sh
```

| 修改位置 | 是否需要重启 |
|----------|--------------|
| `backend/` 任意 Python 文件 | **是**，重启 `./start.sh` 或 `./start.sh backend` |
| `frontend/src/` 任意文件 | **是**，重启 `./start.sh` 或 `./start.sh frontend` |
| `data/token.json` | 无需重启，但 Token 变更后建议刷新页面 |
| 仅改 README / 文档 | 否 |

仅改后端时：

```bash
# Ctrl+C 后
./start.sh backend
```

仅改前端时（后端保持运行）：

```bash
# 另一个终端，Ctrl+C 前端后
./start.sh frontend
```

---

## 功能

- 手动刷新持仓与收益（右上角刷新按钮）
- 大盘指数（上证、沪深300、深证、创业板）
- 多账户分组 Tab
- 分组收益曲线
- 基金搜索、添加、删除持仓
- 微信扫码登录

---

## 目录结构

```
yjb-realtime/
├── reset.sh           # 清除数据与依赖
├── start.sh           # 安装并启动
├── data/              # 运行时数据（token.json，勿提交敏感信息）
├── backend/
├── frontend/
├── TECH.md            # 技术文档
└── API_README.md      # 养基宝上游 API
```

---

## API 速查

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/auth/status` | 登录状态 |
| `POST /api/auth/qrcode` | 登录二维码 |
| `GET /api/portfolio` | 持仓快照（手动刷新） |
| `GET /api/income/line?collect=true` | 汇总收益曲线 |
| `GET /api/funds/search?keyword=` | 搜索基金 |
| `POST /api/funds/hold` | 添加持仓 |
| `DELETE /api/funds/hold` | 删除持仓 |

详见 [TECH.md](./TECH.md)、[API_README.md](./API_README.md)。

---

## 常见问题

### `Blocked by sandbox network policy`

后端在 Cursor 内置终端运行，外网被拦截。请改用 **Terminal.app** 执行 `./start.sh`。

### 想完全重来

```bash
./reset.sh && ./start.sh
```

重新扫码登录即可。
