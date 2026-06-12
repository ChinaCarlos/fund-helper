#!/usr/bin/env bash
# 清除运行时数据与依赖，恢复到可全新安装的状态
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> 停止占用端口的进程（如有）..."
for port in 8000 3000; do
  pids="$(lsof -ti :"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "    结束端口 $port: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
done

echo "==> 清除 data/ 运行时数据..."
rm -f "$ROOT/data/"*.json
touch "$ROOT/data/.gitkeep"

echo "==> 清除后端虚拟环境..."
rm -rf "$ROOT/backend/.venv"
find "$ROOT/backend" -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

echo "==> 清除前端依赖与构建产物..."
rm -rf "$ROOT/frontend/node_modules" "$ROOT/frontend/dist"
rm -f "$ROOT/frontend/package-lock.json"

echo ""
echo "✅ 清理完成。请执行全新安装："
echo ""
echo "  cd $ROOT"
echo "  ./start.sh          # 在系统终端 (Terminal.app) 中运行"
echo ""
echo "首次会重新安装 uv 依赖与 pnpm 包，浏览器打开 http://localhost:3000 后需重新扫码登录。"
