#!/usr/bin/env node
/**
 * Fund Helper 扩展发版 CLI（Chrome + VS Code + JetBrains）
 *
 * 用法:
 *   node scripts/release.mjs                          # 交互式菜单
 *   node scripts/release.mjs list                   # 查看当前版本
 *   node scripts/release.mjs bump <product> patch|minor|major
 *   node scripts/release.mjs chrome [--local|--release|--collect]
 *   node scripts/release.mjs vscode [--local|--release|--collect|--marketplace]
 *   node scripts/release.mjs jetbrains [--local|--release|--collect]
 *   node scripts/release.mjs all [--local|--release]
 *
 * 示例:
 *   node scripts/release.mjs bump chrome patch && node scripts/release.mjs chrome --release
 *   node scripts/release.mjs jetbrains --release
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';
import { readVersions } from './version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EXTENSION_PRODUCTS = ['chrome', 'vscode', 'jetbrains'];

const MODES = {
  chrome: ['--local', '--release', '--collect'],
  vscode: ['--local', '--release', '--collect', '--marketplace'],
  jetbrains: ['--local', '--release', '--collect'],
  all: ['--local', '--release'],
};

function die(message) {
  console.error(`错误: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Fund Helper 扩展发版工具

用法:
  node scripts/release.mjs                         交互式菜单
  node scripts/release.mjs list                    查看版本
  node scripts/release.mjs bump <product> <level>  递增版本 (patch|minor|major)
  node scripts/release.mjs chrome [模式]           Chrome 浏览器插件
  node scripts/release.mjs vscode [模式]           VS Code / Cursor 扩展
  node scripts/release.mjs jetbrains [模式]        JetBrains IDE 插件
  node scripts/release.mjs all [模式]              同时发版 chrome + vscode

模式:
  chrome     --local | --release | --collect
  vscode     --local | --release | --collect | --marketplace
  jetbrains  --local | --release | --collect
  all        --local | --release

快捷 pnpm 命令:
  pnpm release:chrome -- --release
  pnpm release:vscode -- --local
  pnpm release:jetbrains -- --release
  pnpm release:extensions
`);
}

function runScript(script, args = []) {
  const scriptPath = path.join(ROOT, script);
  if (!fs.existsSync(scriptPath)) {
    die(`未找到 ${script}`);
  }
  const result = spawnSync('bash', [scriptPath, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runVersion(args) {
  const result = spawnSync('node', [path.join(ROOT, 'scripts/version.mjs'), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function cmdList() {
  runVersion(['list']);
}

function cmdBump(product, level) {
  if (!EXTENSION_PRODUCTS.includes(product) && product !== 'all') {
    die(`bump 仅支持: ${EXTENSION_PRODUCTS.join(', ')}, all`);
  }
  if (product === 'all') {
    for (const p of EXTENSION_PRODUCTS) {
      runVersion(['bump', p, level]);
    }
    return;
  }
  runVersion(['bump', product, level]);
}

function resolveMode(product, modeArg) {
  const allowed = MODES[product];
  const mode = modeArg ?? '--local';
  if (!allowed.includes(mode)) {
    die(`${product} 不支持模式 ${mode}，可选: ${allowed.join(', ')}`);
  }
  return mode;
}

function cmdChrome(modeArg, versionArg) {
  const mode = resolveMode('chrome', modeArg);
  const args = versionArg ? [versionArg, mode] : [mode];
  runScript('publish-chrome.sh', args);
}

function cmdVscode(modeArg, versionArg) {
  const mode = resolveMode('vscode', modeArg);
  const args = versionArg ? [versionArg, mode] : [mode];
  runScript('publish-vscode.sh', args);
}

function cmdJetbrains(modeArg, versionArg) {
  const mode = resolveMode('jetbrains', modeArg);
  const args = versionArg ? [versionArg, mode] : [mode];
  runScript('publish-jetbrains.sh', args);
}

function cmdAll(modeArg, versionArg) {
  const mode = resolveMode('all', modeArg);
  console.log('\n=== Chrome ===\n');
  cmdChrome(mode, versionArg);
  console.log('\n=== VS Code ===\n');
  cmdVscode(mode, versionArg);
}

async function ask(rl, question) {
  const answer = await rl.question(question);
  return answer.trim();
}

async function interactive() {
  const versions = readVersions();
  const rl = readline.createInterface({ input, output });

  console.log('\n Fund Helper 扩展发版\n');
  console.log(
    `  当前版本  chrome ${versions.chrome}  |  vscode ${versions.vscode}  |  jetbrains ${versions.jetbrains}\n`,
  );
  console.log('  1) Chrome  本地打包 (--local)');
  console.log('  2) Chrome  触发 CI (--release)');
  console.log('  3) Chrome  下载 CI 产物 (--collect)');
  console.log('  4) VS Code  本地打包 (--local)');
  console.log('  5) VS Code  触发 CI (--release)');
  console.log('  6) VS Code  下载 CI 产物 (--collect)');
  console.log('  7) VS Code  上架 Marketplace (--marketplace)');
  console.log('  8) 两者同时触发 CI (--release) [chrome + vscode]');
  console.log('  9) bump patch 并 CI 发版（chrome + vscode）');
  console.log(' 10) JetBrains  本地打包 (--local)');
  console.log(' 11) JetBrains  触发 CI (--release)');
  console.log(' 12) JetBrains  下载 CI 产物 (--collect)');
  console.log('  0) 退出\n');

  const choice = await ask(rl, '请选择 [0-12]: ');
  rl.close();

  switch (choice) {
    case '1':
      cmdChrome('--local');
      break;
    case '2':
      cmdChrome('--release');
      break;
    case '3':
      cmdChrome('--collect');
      break;
    case '4':
      cmdVscode('--local');
      break;
    case '5':
      cmdVscode('--release');
      break;
    case '6':
      cmdVscode('--collect');
      break;
    case '7':
      cmdVscode('--marketplace');
      break;
    case '8':
      cmdAll('--release');
      break;
    case '9':
      cmdBump('all', 'patch');
      cmdAll('--release');
      break;
    case '10':
      cmdJetbrains('--local');
      break;
    case '11':
      cmdJetbrains('--release');
      break;
    case '12':
      cmdJetbrains('--collect');
      break;
    case '0':
      break;
    default:
      die(`无效选项: ${choice}`);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    interactive();
    return;
  }

  const [command, arg1, arg2, arg3] = args;

  switch (command) {
    case 'list':
      cmdList();
      break;
    case 'bump':
      if (!arg1 || !arg2) die('用法: bump <chrome|vscode|jetbrains|all> patch|minor|major');
      cmdBump(arg1, arg2);
      break;
    case 'chrome':
      cmdChrome(arg1, arg2);
      break;
    case 'vscode':
      cmdVscode(arg1, arg2);
      break;
    case 'jetbrains':
      cmdJetbrains(arg1, arg2);
      break;
    case 'all':
      cmdAll(arg1, arg2);
      break;
    case '--help':
    case '-h':
    case 'help':
      usage();
      break;
    default:
      usage();
      die(`未知命令: ${command}`);
  }
}

main();
