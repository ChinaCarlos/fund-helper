# 养基宝实时监控 (YJB Realtime)

基于养基宝 browser-plug-api 的基金收益实时监控面板。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.11+ · FastAPI · httpx · WebSocket |
| 前端 | React 19 · TypeScript · Rsbuild · Ant Design · Biome |

## 功能

- 实时推送总收益与各基金当日收益（WebSocket，默认 30s 轮询）
- 大盘指数展示（上证、沪深300、深证、创业板）
- 多账户分组 Tab（全部 / 支付宝 / 天天基金等）
- 分组收益曲线（汇总 + 各分组独立，支持鼠标悬浮）
- 基金搜索、添加持仓、删除持仓
- Token 失效时自动跳转微信扫码登录页
- 后端生成高清登录二维码

## 快速启动

### 1. 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:3000

### 一键启动（macOS/Linux）

```bash
chmod +x start.sh
./start.sh
```

## 目录结构

```
yjb-realtime/
├── backend/           # FastAPI 服务
│   └── app/
│       ├── api/       # REST + WebSocket
│       ├── services/  # 轮询 & 广播
│       └── yjb/       # 养基宝 API 客户端
├── frontend/          # React 面板
│   └── src/
│       ├── pages/     # Dashboard / Login
│       └── components/
├── data/              # token.json（自动生成）
└── start.sh
```

## API

| 端点 | 说明 |
|------|------|
| `GET /api/auth/status` | 登录状态 |
| `POST /api/auth/qrcode` | 获取登录二维码（含 base64 图片） |
| `GET /api/auth/qrcode/{id}/status` | 轮询扫码状态 |
| `GET /api/portfolio` | 当前持仓快照 |
| `GET /api/accounts` | 分组账户列表 |
| `GET /api/income/line?collect=true` | 汇总当日收益曲线 |
| `GET /api/income/line?account_id={id}` | 单分组收益曲线 |
| `GET /api/income/lines?account_ids[]={id}` | 批量分组收益曲线 |
| `GET /api/funds/search?keyword=` | 搜索基金 |
| `POST /api/funds/hold` | 添加持仓 |
| `DELETE /api/funds/hold?account_id=&fund_ids[]=` | 删除持仓 |
| `WS /ws` | 实时推送 |

收益曲线分组 ID 即 `user_account.list[].id`，详见 [API_README.md](./API_README.md) 第 9 节。

## Token 说明

- 首次启动会自动从 `../yjb-plugin-1.1.4/scripts/token.json` 迁移 token
- 登录成功后保存到 `data/token.json`
- Token 失效时前端自动跳转 `/login`
