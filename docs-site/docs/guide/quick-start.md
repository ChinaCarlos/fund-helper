---
title: 快速开始
---

# 快速开始

## 方式一：Docker 快速体验（推荐）

无需本地构建，拉取预构建镜像即可：

```bash
git clone https://github.com/ChinaCarlos/fund-helper.git
cd fund-helper

docker compose --profile full pull
docker compose --profile full up -d
```

浏览器打开 **http://localhost:8080**

| 项 | 默认值 |
|----|--------|
| 用户名 | `admin` |
| 密码 | `123456` |

登录后可在首页绑定养基宝（微信扫码）查看持仓。

## 方式二：本地开发

```bash
cd fund-helper
pnpm install

./dev-infra.sh   # 启动开发 MongoDB
./start.sh       # 后端 :8000 + 前端 :3000
```

- 后端：http://localhost:8000
- 前端：http://localhost:3000

## 方式三：轻量客户端（无需后端）

| 客户端 | 步骤 |
|--------|------|
| Chrome | 下载 [chrome-v1.0.2](https://github.com/ChinaCarlos/fund-helper/releases/tag/chrome-v1.0.2) zip → 解压 → `chrome://extensions` 加载 |
| VS Code | [Marketplace](https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode) 或 [VSIX](https://github.com/ChinaCarlos/fund-helper/releases/tag/vscode-v0.1.3) |
| Desktop | [desktop-v0.1.1](https://github.com/ChinaCarlos/fund-helper/releases/tag/desktop-v0.1.1) 下载 DMG / exe |

各客户端详细说明见 [客户端概览](/clients/overview)。

## 文档站本地预览

```bash
pnpm install
pnpm dev:docs
```

默认 http://localhost:5173（Rspress dev server）。
