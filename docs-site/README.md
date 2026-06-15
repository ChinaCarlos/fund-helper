# Fund Helper 文档站

基于 [Rspress 2](https://rspress.rs/zh/ui/vars) 构建，主题色通过 CSS 变量定制（见 `theme/index.css`）。

## 本地开发

```bash
# 在仓库根目录
pnpm install
pnpm dev:docs
```

浏览器打开 http://localhost:5173

## 构建

```bash
pnpm build:docs
pnpm preview:docs   # 预览 doc_build/
```

## 内容同步

`predev` / `prebuild` 会自动执行 `scripts/sync-docs-site.mjs`，将根目录 `README.md`、`TECH.md`、`API_README.md` 及各客户端 README 同步到 `docs/`。

JetBrains 插件用户文档为手写页 `docs/clients/jetbrains-extension.md`（版本号由 `scripts/sync-docs.mjs` 维护），不同步 `jetbrains-extension/README.md` 全文。

## 部署

推送 `main` 后由 [`.github/workflows/docs.yml`](../.github/workflows/docs.yml) 部署至 GitHub Pages：

**https://chinacarlos.github.io/fund-helper/**

首次需在仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
