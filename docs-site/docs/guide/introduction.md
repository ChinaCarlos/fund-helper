---
title: 项目介绍
---

# 项目介绍

**Fund Helper** 是基于养基宝 `browser-plug-api` 的基金收益实时监控面板，面向个人投资者与开发者开源。

## 五种使用方式

| 方式 | 定位 | 是否需要后端 |
|------|------|--------------|
| [Web 应用](/guide/project-overview) | 完整功能：持仓、市场排行、板块热力图、通知、多用户 | ✅ FastAPI + MongoDB |
| [Chrome 插件](/clients/chrome-extension) | 工具栏 Popup 快速看持仓 | ❌ |
| [VS Code 扩展](/clients/vscode-extension) | 编辑器侧边栏 / 底部 Panel / 状态栏 | ❌ |
| [JetBrains 插件](/clients/jetbrains-extension) | IDEA / WebStorm / PyCharm 内 Tool Window + 状态栏 | ❌ |
| [桌面端](/clients/desktop) | Tauri 原生客户端 + 本地通知 | ❌ |

## 技术栈一览

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12 · FastAPI · httpx |
| Web 前端 | React 19 · Rsbuild · Ant Design |
| 浏览器插件 | CRXJS · Vite · Manifest V3 |
| VS Code | Extension Host · Webview · React |
| JetBrains | Kotlin · JCEF · Gradle · React Webview |
| 桌面端 | Tauri v2 · Rust · SQLite |
| 文档 | [Rspress](https://rspress.rs/zh/ui/vars) · GitHub Pages |

## 仓库结构

```
fund-helper/
├── backend/              # FastAPI BFF
├── web/                  # Web SPA
├── chrome-extension/     # 浏览器插件
├── vscode-extension/     # VS Code / Cursor 扩展
├── jetbrains-extension/  # JetBrains IDE 插件
├── desktop/              # Tauri 桌面端
├── docs-site/            # 本文档站（Rspress）
└── scripts/              # 版本管理与发版脚本
```

## 下一步

- [快速开始](/guide/quick-start) — Docker 体验或轻量客户端安装
- [客户端概览](/clients/overview) — 下载与选型
- [发版与下载](/developer/release) — CI 构建与版本号管理
