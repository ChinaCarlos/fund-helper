#!/usr/bin/env bash
# 构建并推送应用镜像到 Docker Hub
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
IMAGE="carloscca/fund-helper"
TAG="${1:-latest}"

cd "$ROOT"

echo "==> 构建镜像 ${IMAGE}:${TAG} ..."
docker build -t "${IMAGE}:${TAG}" .

if [ "$TAG" = "latest" ]; then
  docker tag "${IMAGE}:${TAG}" "${IMAGE}:latest"
fi

echo "==> 推送镜像 ..."
docker push "${IMAGE}:${TAG}"
if [ "$TAG" != "latest" ]; then
  docker push "${IMAGE}:latest"
fi

echo ""
echo "✅ 已推送: ${IMAGE}:${TAG}"
echo ""
echo "他人使用："
echo "  git clone https://github.com/ChinaCarlos/fund-helper.git"
echo "  cd fund-helper"
echo "  docker compose --profile full pull"
echo "  docker compose --profile full up -d"
