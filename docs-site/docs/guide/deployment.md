---
title: 部署指南
---

# 部署指南

## Docker 一体部署（本地构建）

```bash
docker compose --profile full up -d --build
```

访问 http://localhost:8080

- API 与静态前端同容器（`SERVE_STATIC=true`）
- MongoDB 数据卷 `mongo_data`
- 环境变量见 `.env.docker.example`

## 维护者发布 Docker 镜像

```bash
chmod +x publish-image.sh
docker login
./publish-image.sh          # 可选: ./publish-image.sh v1.0.0
```

镜像：`carloscca/fund-helper:latest`

## 客户端 CI 发版

三个客户端由 GitHub Actions 构建，版本统一由 `versions.json` 管理：

```bash
pnpm version:list
node scripts/version.mjs bump chrome patch
./publish-chrome.sh --release
./publish-vscode.sh --release
./publish-desktop.sh --release
```

完整说明见 [发版与下载](/developer/release)。

## GitHub Pages 文档站

文档站位于 `docs-site/`，推送 `main` 分支后由 [Docs workflow](https://github.com/ChinaCarlos/fund-helper/actions/workflows/docs.yml) 自动部署至：

**https://chinacarlos.github.io/fund-helper/**
