---
title: 客户端概览
---

# 客户端概览

## 免责声明

> - 本项目仅用于个人学习、研究和技术交流。项目中对养基宝 `browser-plug-api` 的理解来自对公开浏览器插件网络交互的学习与反向工程分析；本项目非养基宝官方产品，与养基宝或任何第三方机构不存在从属、授权、合作或背书关系。请勿用于商业化、批量抓取、绕过限制或任何违反平台协议、法律法规的用途；因使用本项目或二次开发产生的任何责任与项目作者无关。
> - 项目展示的基金、股票、指数、收益等金融数据仅用于软件功能展示和技术研究，不构成投资建议、理财推荐或收益承诺。基金/股票有风险，投资需谨慎，请自行判断并承担风险。



Fund Helper 提供五种客户端，共享养基宝数据归一化逻辑（`nv_info` 解析、预估/已更新标签等），按场景选择即可。

## 下载入口

| 客户端 | 当前版本 | 安装 |
|--------|----------|------|
| **Chrome** | 1.0.2 | [chrome-v1.0.2 Release](https://github.com/ChinaCarlos/fund-helper/releases/tag/chrome-v1.0.2) |
| **VS Code** | 0.1.3 | [Marketplace](https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode) · [VSIX Release](https://github.com/ChinaCarlos/fund-helper/releases/tag/vscode-v0.1.3) |
<!-- fund-helper:version:jetbrains-row -->
| **JetBrains** | 0.1.1 | [jetbrains-v0.1.1 Release](https://github.com/ChinaCarlos/fund-helper/releases/tag/jetbrains-v0.1.1) |
<!-- /fund-helper:version:jetbrains-row -->
| **Desktop** | 0.1.1 | [desktop-v0.1.1 Release](https://github.com/ChinaCarlos/fund-helper/releases/tag/desktop-v0.1.1) |

## 详细文档

- [Chrome 浏览器插件](/clients/chrome-extension)
- [VS Code / Cursor 扩展](/clients/vscode-extension)
- [JetBrains IDE 插件](/clients/jetbrains-extension)
- [桌面端（Tauri）](/clients/desktop)

## 构建状态

[![Chrome Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/chrome-release.yml/badge.svg)](https://github.com/ChinaCarlos/fund-helper/actions/workflows/chrome-release.yml)
[![VS Code Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/vscode-release.yml/badge.svg)](https://github.com/ChinaCarlos/fund-helper/actions/workflows/vscode-release.yml)
[![JetBrains Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/jetbrains-release.yml/badge.svg)](https://github.com/ChinaCarlos/fund-helper/actions/workflows/jetbrains-release.yml)
[![Desktop Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml/badge.svg)](https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml)

## 选择建议

| 你的场景 | 推荐 |
|----------|------|
| 写代码时看持仓（VS Code / Cursor） | VS Code 扩展 |
| 写代码时看持仓（IDEA / WebStorm / PyCharm） | JetBrains 插件 |
| 浏览网页时快速查看 | Chrome 插件 |
| 需要通知推送 + 原生体验 | 桌面端 |
| 市场排行、多用户、完整面板 | Web 应用 |
