#!/usr/bin/env node
/**
 * 将项目根目录 Markdown 同步到 docs-site/docs，供 Rspress 构建。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs-site/docs');
const REPO = 'https://github.com/ChinaCarlos/fund-helper';
const REPO_BLOB = `${REPO}/blob/main`;

/** @type {Array<{ src: string; dest: string; title: string }>} */
const SYNC_MAP = [
  { src: 'README.md', dest: 'guide/project-overview.md', title: '项目概览' },
  { src: 'TECH.md', dest: 'developer/architecture.md', title: '技术架构' },
  { src: 'API_README.md', dest: 'developer/yjb-api.md', title: '养基宝 API' },
  { src: 'chrome-extension/README.md', dest: 'clients/chrome-extension.md', title: 'Chrome 浏览器插件' },
  { src: 'vscode-extension/README.md', dest: 'clients/vscode-extension.md', title: 'VS Code 扩展' },
  { src: 'desktop/README.md', dest: 'clients/desktop.md', title: '桌面端' },
  { src: 'assets/releases/README.md', dest: 'developer/release.md', title: '发版与下载' },
];

function stripFirstHeading(content) {
  return content.replace(/^#\s+.+\n+/, '');
}

function rewriteLinks(content) {
  let out = content;

  // 版本占位注释
  out = out.replace(/<!-- fund-helper:version:[^>]+-->\n?/g, '');
  out = out.replace(/<!-- \/fund-helper:version:[^>]+-->\n?/g, '');

  // 文档内交叉引用
  const docMap = [
    [/\]\(\.\.\/TECH\.md([^)]*)\)/g, '](/developer/architecture$1)'],
    [/\]\(\.\/TECH\.md([^)]*)\)/g, '](/developer/architecture$1)'],
    [/\]\(\.\.\/API_README\.md([^)]*)\)/g, '](/developer/yjb-api$1)'],
    [/\]\(\.\/API_README\.md([^)]*)\)/g, '](/developer/yjb-api$1)'],
    [/\]\(\.\.\/chrome-extension\/README\.md([^)]*)\)/g, '](/clients/chrome-extension$1)'],
    [/\]\(\.\/chrome-extension\/README\.md([^)]*)\)/g, '](/clients/chrome-extension$1)'],
    [/\]\(\.\.\/vscode-extension\/README\.md([^)]*)\)/g, '](/clients/vscode-extension$1)'],
    [/\]\(\.\/vscode-extension\/README\.md([^)]*)\)/g, '](/clients/vscode-extension$1)'],
    [/\]\(\.\.\/jetbrains-extension\/README\.md([^)]*)\)/g, '](/clients/jetbrains-extension$1)'],
    [/\]\(\.\/jetbrains-extension\/README\.md([^)]*)\)/g, '](/clients/jetbrains-extension$1)'],
    [/\]\(\.\.\/desktop\/README\.md([^)]*)\)/g, '](/clients/desktop$1)'],
    [/\]\(\.\/desktop\/README\.md([^)]*)\)/g, '](/clients/desktop$1)'],
    [/\]\(\.\.\/assets\/releases\/README\.md([^)]*)\)/g, '](/developer/release$1)'],
    [/\]\(\.\/assets\/releases\/README\.md([^)]*)\)/g, '](/developer/release$1)'],
    [/\]\(\.\.\/README\.md([^)]*)\)/g, '](/guide/project-overview$1)'],
    [/\]\(\.\/README\.md([^)]*)\)/g, '](/guide/project-overview$1)'],
  ];
  for (const [pattern, replacement] of docMap) {
    out = out.replace(pattern, replacement);
  }

  // 仓库内非文档文件 → GitHub blob
  const githubMap = [
    [/\]\(\.\.\/publish-([a-z-]+)\.sh([^)]*)\)/g, `](${REPO_BLOB}/publish-$1.sh$2)`],
    [/\]\(\.\/publish-([a-z-]+)\.sh([^)]*)\)/g, `](${REPO_BLOB}/publish-$1.sh$2)`],
    [/\]\(\.\.\/\.github\/([^)]+)\)/g, `](${REPO_BLOB}/.github/$1)`],
    [/\]\(\.\.\/\.vscode\/([^)]+)\)/g, `](${REPO_BLOB}/.vscode/$1)`],
    [/\]\(\.\/\.vscode\/([^)]+)\)/g, `](${REPO_BLOB}/.vscode/$1)`],
    [/\]\(\.\.\/\.env\.docker\.example([^)]*)\)/g, `](${REPO_BLOB}/.env.docker.example$1)`],
    [/\]\(\.\.\/backend\/\.env\.example([^)]*)\)/g, `](${REPO_BLOB}/backend/.env.example$1)`],
    [/\]\(\.\.\/LICENSE([^)]*)\)/g, `](${REPO_BLOB}/vscode-extension/LICENSE$1)`],
    [/\]\(LICENSE([^)]*)\)/g, `](${REPO_BLOB}/vscode-extension/LICENSE$1)`],
  ];
  for (const [pattern, replacement] of githubMap) {
    out = out.replace(pattern, replacement);
  }

  // 图片资源复制到 public 并改写路径
  out = out.replace(
    /\]\(\.\.\/vscode-extension\/docs\/entry-points\.png\)/g,
    '](/entry-points.png)',
  );
  out = out.replace(
    /\]\(\.\/vscode-extension\/docs\/entry-points\.png\)/g,
    '](/entry-points.png)',
  );

  // Shiki 不支持的代码块语言
  out = out.replace(/```env\b/g, '```bash');

  return out;
}

function copyAssets() {
  const imgSrc = path.join(ROOT, 'vscode-extension/docs/entry-points.png');
  const imgDest = path.join(DOCS, 'public/entry-points.png');
  if (fs.existsSync(imgSrc)) {
    fs.mkdirSync(path.dirname(imgDest), { recursive: true });
    fs.copyFileSync(imgSrc, imgDest);
    console.log('  ✓ vscode-extension/docs/entry-points.png → docs/public/');
  }
}

function syncOne({ src, dest, title }) {
  const srcPath = path.join(ROOT, src);
  const destPath = path.join(DOCS, dest);
  if (!fs.existsSync(srcPath)) {
    console.warn(`  ⚠ 跳过（源文件不存在）: ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const raw = fs.readFileSync(srcPath, 'utf8');
  const body = rewriteLinks(stripFirstHeading(raw));
  fs.writeFileSync(destPath, `---\ntitle: ${title}\n---\n\n${body}`);
  console.log(`  ✓ ${src} → docs/${dest}`);
}

console.log('同步文档到 docs-site/docs …');
copyAssets();
for (const item of SYNC_MAP) {
  syncOne(item);
}
console.log('文档同步完成。');
