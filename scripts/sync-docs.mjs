/**
 * 根据 versions.json 同步文档与 CI workflow 中的版本号占位块。
 * 由 scripts/version.mjs 在 set / bump / sync 时调用。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'ChinaCarlos/fund-helper';

const MARKER = (id) => `<!-- fund-helper:version:${id} -->`;
const MARKER_END = (id) => `<!-- /fund-helper:version:${id} -->`;

function block(id, body) {
  return `${MARKER(id)}\n${body.trim()}\n${MARKER_END(id)}`;
}

function replaceBlock(filePath, id, body) {
  const abs = path.join(ROOT, filePath);
  if (!fs.existsSync(abs)) {
    console.warn(`  ⚠ 跳过文档（不存在）: ${filePath}`);
    return;
  }
  const text = fs.readFileSync(abs, 'utf8');
  const start = MARKER(id);
  const end = MARKER_END(id);
  const nextBlock = block(id, body);
  if (text.includes(start) && text.includes(end)) {
    const re = new RegExp(
      `${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`,
      'm',
    );
    fs.writeFileSync(abs, text.replace(re, nextBlock));
    console.log(`  ✓ docs ${filePath} [${id}]`);
    return;
  }
  console.warn(`  ⚠ 未找到标记 ${id} in ${filePath}，跳过`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function desktopDownloadRows(version) {
  const tag = `desktop-v${version}`;
  return `| **macOS（Universal，M + Intel）** | \`Fund-Helper-${version}-macos.dmg\` | [${tag} Release](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |
| **Windows** | \`Fund-Helper-${version}-windows-setup.exe\` | 同上 Release 页 |`;
}

function desktopReadmeRows(version) {
  const tag = `desktop-v${version}`;
  return `| macOS（Universal，Apple Silicon + Intel） | \`Fund-Helper-${version}-macos.dmg\` | [Release ${tag}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |
| Windows | \`Fund-Helper-${version}-windows-setup.exe\` | 同上 |`;
}

function vscodeInstallRows(version) {
  const tag = `vscode-v${version}`;
  const vsix = `fund-helper-vscode-${version}.vsix`;
  return `| **Cursor / Trae / CodeBuddy / Qoder** | VSIX 文件 | [下载 VSIX](https://github.com/${GITHUB_REPO}/releases/download/${tag}/${vsix}) |

Release 页：[\`${tag}\`](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) · 文件 \`${vsix}\``;
}

function vscodeReadmeVsix(version) {
  const tag = `vscode-v${version}`;
  const vsix = `fund-helper-vscode-${version}.vsix`;
  return `**VSIX 下载地址（v${version}）：**

| 来源 | 地址 |
|------|------|
| **GitHub Release（推荐）** | https://github.com/${GITHUB_REPO}/releases/download/${tag}/${vsix} |
| **Release 页** | [${tag}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |

**安装步骤：**

1. 打开 [Release ${tag}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) 下载 \`${vsix}\``;
}

function chromeReleasesSection(version) {
  const tag = `chrome-v${version}`;
  return `| 项 | 链接 |
|----|------|
| 当前版本 | \`${version}\`（见 \`versions.json\`） |
| 构建 | [Actions → Chrome Extension Release](https://github.com/${GITHUB_REPO}/actions/workflows/chrome-release.yml) |
| 下载 | [Release ${tag}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |`;
}

function desktopReleasesSection(version) {
  const tag = `desktop-v${version}`;
  return `| 项 | 链接 |
|----|------|
| 当前版本 | \`${version}\` |
| 构建 | [Actions → Desktop Release](https://github.com/${GITHUB_REPO}/actions/workflows/desktop-release.yml) |
| 下载 | [Release ${tag}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |

| 平台 | 文件名 |
|------|--------|
| macOS（Universal） | \`Fund-Helper-${version}-macos.dmg\` |
| Windows | \`Fund-Helper-${version}-windows-setup.exe\` |`;
}

function vscodeReleasesSection(version) {
  const tag = `vscode-v${version}`;
  return `| 项 | 链接 |
|----|------|
| 当前版本 | \`${version}\` |
| Marketplace | [Fund Helper](https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode) |
| VSIX 下载 | [Release ${tag}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |`;
}

function jetbrainsReleasesSection(version) {
  const tag = `jetbrains-v${version}`;
  return `| 项 | 链接 |
|----|------|
| 当前版本 | \`${version}\`（见 \`versions.json\`） |
| 构建 | [Actions → JetBrains Plugin Release](https://github.com/${GITHUB_REPO}/actions/workflows/jetbrains-release.yml) |
| 下载 | [Release ${tag}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |`;
}

function jetbrainsReadmeZip(version) {
  const tag = `jetbrains-v${version}`;
  const zip = `fund-helper-jetbrains-${version}.zip`;
  return `**插件包下载（v${version}）：**

| 来源 | 地址 |
|------|------|
| **GitHub Release（推荐）** | https://github.com/${GITHUB_REPO}/releases/download/${tag}/${zip} |
| **Release 页** | [${tag}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |

安装：**Settings → Plugins → ⚙ → Install Plugin from Disk…** → 选择 \`${zip}\``;
}

function jetbrainsInstallRows(version) {
  const tag = `jetbrains-v${version}`;
  const zip = `fund-helper-jetbrains-${version}.zip`;
  return `| **IntelliJ IDEA / WebStorm / PyCharm 等** | 插件 zip | [下载 zip](https://github.com/${GITHUB_REPO}/releases/download/${tag}/${zip}) |

Release 页：[\`${tag}\`](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) · 文件 \`${zip}\``;
}

function jetbrainsQuickStartRow(version) {
  const tag = `jetbrains-v${version}`;
  return `| JetBrains | [jetbrains-v${version}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) zip → **Settings → Plugins → Install Plugin from Disk…** |`;
}

function readmeClientTableRow(version) {
  const tag = `jetbrains-v${version}`;
  return `| JetBrains 插件 | \`${version}\` | [JetBrains Release CI](https://github.com/${GITHUB_REPO}/actions/workflows/jetbrains-release.yml) | [${tag}](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |`;
}

function jetbrainsOverviewRow(version) {
  const tag = `jetbrains-v${version}`;
  return `| **JetBrains** | ${version} | [${tag} Release](https://github.com/${GITHUB_REPO}/releases/tag/${tag}) |`;
}

function updateWorkflowDefault(workflowFile, version) {
  const abs = path.join(ROOT, workflowFile);
  if (!fs.existsSync(abs)) return;
  const text = fs.readFileSync(abs, 'utf8');
  const next = text.replace(
    /(workflow_dispatch:[\s\S]*?version:[\s\S]*?default: )'[^']+'/m,
    `$1'${version}'`,
  );
  if (next !== text) {
    fs.writeFileSync(abs, next);
    console.log(`  ✓ workflow ${workflowFile} default → ${version}`);
  }
}

/** 同步全部文档与 workflow 默认值 */
export function syncAllDocs(versions) {
  console.log('同步文档与 CI 默认版本…');

  replaceBlock('README.md', 'desktop-download', desktopDownloadRows(versions.desktop));
  replaceBlock('README.md', 'vscode-install', vscodeInstallRows(versions.vscode));

  replaceBlock('desktop/README.md', 'download', desktopReadmeRows(versions.desktop));

  replaceBlock('vscode-extension/README.md', 'vsix-download', vscodeReadmeVsix(versions.vscode));

  replaceBlock('jetbrains-extension/README.md', 'plugin-download', jetbrainsReadmeZip(versions.jetbrains));

  replaceBlock('assets/releases/README.md', 'chrome', chromeReleasesSection(versions.chrome));
  replaceBlock('assets/releases/README.md', 'desktop', desktopReleasesSection(versions.desktop));
  replaceBlock('assets/releases/README.md', 'vscode', vscodeReleasesSection(versions.vscode));
  replaceBlock('assets/releases/README.md', 'jetbrains', jetbrainsReleasesSection(versions.jetbrains));

  replaceBlock('README.md', 'jetbrains-client', readmeClientTableRow(versions.jetbrains));
  replaceBlock('README.md', 'jetbrains-install', jetbrainsInstallRows(versions.jetbrains));

  replaceBlock('docs-site/docs/clients/overview.md', 'jetbrains-row', jetbrainsOverviewRow(versions.jetbrains));
  replaceBlock('docs-site/docs/clients/jetbrains-extension.md', 'plugin-download', jetbrainsReadmeZip(versions.jetbrains));
  replaceBlock('docs-site/docs/guide/quick-start.md', 'jetbrains-quick-start', jetbrainsQuickStartRow(versions.jetbrains));
  replaceBlock('docs-site/docs/developer/release.md', 'jetbrains', jetbrainsReleasesSection(versions.jetbrains));

  updateWorkflowDefault('.github/workflows/chrome-release.yml', versions.chrome);
  updateWorkflowDefault('.github/workflows/vscode-release.yml', versions.vscode);
  updateWorkflowDefault('.github/workflows/desktop-release.yml', versions.desktop);
  updateWorkflowDefault('.github/workflows/jetbrains-release.yml', versions.jetbrains);
}

/** 仅同步某一产品相关文档（仍会刷新 workflow 中该产品默认值） */
export function syncProductDocs(product, versions) {
  syncAllDocs(versions);
}
