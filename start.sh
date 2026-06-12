#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

start_backend() {
  cd "$ROOT/backend"
  if [ ! -d .venv ]; then
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt -q
  fi
  .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

start_frontend() {
  cd "$ROOT/frontend"
  if [ ! -d node_modules ]; then
    npm install
  fi
  npm run dev
}

case "${1:-all}" in
  backend) start_backend ;;
  frontend) start_frontend ;;
  *)
    echo "启动后端 (8000) 和前端 (3000)..."
    start_backend &
    BACK_PID=$!
    trap 'kill $BACK_PID 2>/dev/null' EXIT
    sleep 2
    start_frontend
    ;;
esac
