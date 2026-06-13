#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

ensure_uv() {
  if ! command -v uv &>/dev/null; then
    echo "未找到 uv，请先安装："
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
  fi
}

check_outbound_network() {
  local probe
  probe="$(curl -s --connect-timeout 5 http://browser-plug-api.yangjibao.com/ 2>&1 || true)"
  if echo "$probe" | grep -qi "sandbox network policy"; then
    echo ""
    echo "❌ 当前终端无法访问养基宝 API（Cursor 沙箱拦截外网）。"
    echo ""
    echo "请在系统终端 (Terminal.app / iTerm) 中运行："
    echo "  cd $ROOT && ./start.sh"
    echo ""
    exit 1
  fi
}

venv_python() {
  echo "$ROOT/backend/.venv/bin/python"
}

venv_is_usable() {
  local py
  py="$(venv_python)"
  [ -x "$py" ] && "$py" -c "import uvicorn" 2>/dev/null
}

ensure_backend_venv() {
  cd "$ROOT/backend"
  if [ -d .venv ] && ! venv_is_usable; then
    echo "==> 检测到虚拟环境已损坏（常见于项目目录迁移），正在重建..."
    rm -rf .venv
  fi
  if [ ! -d .venv ]; then
    echo "==> 创建虚拟环境..."
    uv venv
  fi
  echo "==> 同步后端依赖..."
  uv pip install -r requirements.txt -q
}

mongodb_ping() {
  cd "$ROOT/backend"
  local py
  py="$(venv_python)"
  "$py" -c "
from app.config import settings
import sys
try:
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    async def ping():
        client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=3000)
        await client.admin.command('ping')
        client.close()
    asyncio.run(ping())
except Exception:
    sys.exit(1)
" 2>/dev/null
}

ensure_mongodb() {
  if mongodb_ping; then
    return 0
  fi

  if command -v docker &>/dev/null; then
    echo "==> MongoDB 未就绪，尝试启动开发库（docker compose --profile dev up -d mongo-dev）..."
    (cd "$ROOT" && docker compose --profile dev up -d mongo-dev) || true
    for _ in $(seq 1 30); do
      if mongodb_ping; then
        echo "==> MongoDB 已连接: ${MONGODB_URI:-mongodb://localhost:27017}"
        return 0
      fi
      sleep 1
    done
  fi

  echo ""
  echo "❌ 无法连接 MongoDB（${MONGODB_URI:-mongodb://localhost:27017}）。"
  echo ""
  echo "本地开发请先启动项目内的 MongoDB 容器："
  echo "  ./dev-infra.sh"
  echo "  或: docker compose --profile dev up -d mongo-dev"
  echo ""
  echo "注意：mongodb://mongo:27017 仅适用于 Docker 内的 app 容器，"
  echo "      本机 ./start.sh 应使用 mongodb://localhost:27017"
  echo ""
  exit 1
}

start_backend() {
  ensure_uv
  check_outbound_network
  ensure_backend_venv
  ensure_mongodb
  cd "$ROOT/backend"
  echo "==> 启动后端 http://localhost:8000"
  # 后端拉东财数据需直连，避免 Cursor/Clash 注入的 HTTP 代理导致 ProxyError
  env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy \
    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
}

ensure_pnpm() {
  if ! command -v pnpm &>/dev/null; then
    echo "未找到 pnpm，请先安装："
    echo "  corepack enable && corepack prepare pnpm@latest --activate"
    echo "  或: npm install -g pnpm"
    exit 1
  fi
}

start_web() {
  ensure_pnpm
  cd "$ROOT/web"
  if [ ! -d node_modules ]; then
    echo "==> 安装 Web 依赖 (pnpm)..."
    pnpm install
  fi
  echo "==> 启动 Web http://localhost:3000"
  pnpm dev
}

case "${1:-all}" in
  backend) start_backend ;;
  web) start_web ;;
  *)
    echo "启动后端 (8000) 和 Web (3000)..."
    echo "提示：修改代码后请先 Ctrl+C 停止，再重新执行 ./start.sh"
    echo ""
    start_backend &
    BACK_PID=$!
    trap 'kill $BACK_PID 2>/dev/null' EXIT
    sleep 2
    start_web
    ;;
esac
