#!/usr/bin/env bash
# 清除依赖与 Docker 数据卷，恢复到可全新安装的状态
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> 停止占用端口的进程（如有）..."
for port in 8000 3000 8080; do
  pids="$(lsof -ti :"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "    结束端口 $port: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
done

echo "==> 停止 Docker 容器并清除 MongoDB 数据卷（dev + full）..."
if command -v docker &>/dev/null; then
  (cd "$ROOT" && docker compose --profile dev --profile full down -v 2>/dev/null) || true
fi

echo "==> 清除后端虚拟环境..."
rm -rf "$ROOT/backend/.venv"
find "$ROOT/backend" -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

echo "==> 清除前端依赖与构建产物..."
rm -rf "$ROOT/web/node_modules" "$ROOT/web/dist"
rm -rf "$ROOT/chrome-extension/node_modules" "$ROOT/chrome-extension/dist"
rm -rf "$ROOT/vscode-extension/node_modules" "$ROOT/vscode-extension/dist"
rm -rf "$ROOT/desktop/node_modules" "$ROOT/desktop/dist"
rm -rf "$ROOT/node_modules"
rm -f "$ROOT/web/package-lock.json" "$ROOT/vscode-extension/package-lock.json"
rm -f "$ROOT/pnpm-lock.yaml"

echo ""
echo "✅ 清理完成。请执行全新安装："
echo ""
echo "  cd $ROOT"
echo "  docker compose --profile full up -d --build   # Docker 一体部署"
echo "  ./dev-infra.sh && ./start.sh                  # 本地开发"
echo ""
