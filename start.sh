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

start_backend() {
  ensure_uv
  check_outbound_network
  cd "$ROOT/backend"
  if [ ! -d .venv ]; then
    echo "==> 创建虚拟环境并安装后端依赖..."
    uv venv
    uv pip install -r requirements.txt
  fi
  echo "==> 启动后端 http://localhost:8000"
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

start_frontend() {
  ensure_pnpm
  cd "$ROOT/frontend"
  if [ ! -d node_modules ]; then
    echo "==> 安装前端依赖 (pnpm)..."
    pnpm install
  fi
  echo "==> 启动前端 http://localhost:3000"
  pnpm dev
}

case "${1:-all}" in
  backend) start_backend ;;
  frontend) start_frontend ;;
  *)
    echo "启动后端 (8000) 和前端 (3000)..."
    echo "提示：修改代码后请先 Ctrl+C 停止，再重新执行 ./start.sh"
    echo ""
    start_backend &
    BACK_PID=$!
    trap 'kill $BACK_PID 2>/dev/null' EXIT
    sleep 2
    start_frontend
    ;;
esac
