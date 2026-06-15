---
title: 常见问题
---

# 常见问题

## `ServerSelectionTimeoutError: mongo:27017`

`mongodb://mongo:27017` 仅用于 Docker 内 app 容器。本机 `./start.sh` 请使用 `mongodb://localhost:27017`，并先执行 `./dev-infra.sh`。

## Docker 容器无法启动

检查 `docker compose logs`，常见为环境变量格式问题。`CORS_ORIGINS` 支持逗号分隔。

## 浏览器插件无法加载

- 使用 Chrome / Edge / 360 极速（Chromium 内核）
- 开发：`cd chrome-extension && pnpm dev`，加载 `dist/` 目录
- 401 时重新扫码登录

## VS Code 扩展底部 Panel 不显示

确保已重载窗口；扩展使用 `onStartupFinished` 在启动后注册 Panel Tab。点击左下角状态栏或命令 `Fund Helper: 打开底部面板`。

## JetBrains 插件

### 界面白屏或一直 Loading

- 需 **IDE 2024.2+** 且 JCEF 可用（Settings → 搜索 JCEF）
- 首次打开侧边栏会加载 JCEF Webview，稍等数秒
- 开发构建需先 `pnpm run build:webview`，再 `./gradlew runIde`

### 底部面板关闭后无法再次打开

点击**状态栏右下角**的收益数字（不是悬浮区域）。请使用最新版插件（已修复 `ToolWindow` 可用性问题）。

### 本地 Gradle 构建失败

配置 **JDK 17** 的 `JAVA_HOME`（Homebrew `openjdk@17`）。Gradle 不要用 IDE 自带的 JBR 25。

详见 [JetBrains 插件文档](/clients/jetbrains-extension)。

## 预估涨幅为 0

养基宝部分基金估算涨幅在 `vgszzl` 字段而非 `gszzl`，Fund Helper 已统一解析，详见 [养基宝 API §7](/developer/yjb-api)。

## 想完全重来

```bash
./reset.sh && ./start.sh
# 或 Docker
docker compose --profile full down -v
docker compose --profile full up -d --build
```

更多细节见 [项目概览](/guide/project-overview) 中的常见问题章节。
