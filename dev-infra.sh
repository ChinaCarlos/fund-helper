#!/usr/bin/env bash
# 本地开发基础设施：独立 MongoDB（数据卷 mongo_dev_data）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! command -v docker &>/dev/null; then
  echo "❌ 未找到 docker，请先安装 Docker Desktop"
  exit 1
fi

echo "==> 启动开发 MongoDB（mongo-dev / 卷 mongo_dev_data）..."
docker compose --profile dev up -d mongo-dev

echo "==> 等待 MongoDB 就绪..."
for _ in $(seq 1 30); do
  if docker compose --profile dev exec -T mongo-dev mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1; then
    echo ""
    echo "✅ 开发 MongoDB 已就绪: mongodb://localhost:27017"
    echo "   数据卷: mongo_dev_data（与 Docker 部署的 mongo_data 隔离）"
    echo ""
    echo "接下来在本机启动应用："
    echo "  ./start.sh"
    exit 0
  fi
  sleep 1
done

echo "❌ MongoDB 启动超时，请检查: docker compose --profile dev logs mongo-dev"
exit 1
