#!/usr/bin/env node
/**
 * 客户端版本统一管理（chrome / vscode / desktop / jetbrains）
 *
 * 用法:
 *   node scripts/version.mjs list
 *   node scripts/version.mjs get <product>
 *   node scripts/version.mjs set <product> <version>
 *   node scripts/version.mjs bump <product> patch|minor|major [--print]
 *   node scripts/version.mjs sync [product|all]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncAllDocs } from './sync-docs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VERSIONS_FILE = path.join(ROOT, 'versions.json');

const PRODUCTS = {
  chrome: {
    label: 'Chrome 浏览器插件',
    tagPrefix: 'chrome-v',
    artifactPrefix: 'fund-helper-chrome',
    paths: {
      packageJson: 'chrome-extension/package.json',
    },
  },
  vscode: {
    label: 'VS Code 扩展',
    tagPrefix: 'vscode-v',
    artifactPrefix: 'fund-helper-vscode',
    paths: {
      packageJson: 'vscode-extension/package.json',
    },
  },
  desktop: {
    label: '桌面端',
    tagPrefix: 'desktop-v',
    artifactPrefix: 'Fund-Helper',
    paths: {
      packageJson: 'desktop/package.json',
      tauriConf: 'desktop/src-tauri/tauri.conf.json',
      cargoToml: 'desktop/src-tauri/Cargo.toml',
    },
  },
  jetbrains: {
    label: 'JetBrains 插件',
    tagPrefix: 'jetbrains-v',
    artifactPrefix: 'fund-helper-jetbrains',
    paths: {
      packageJson: 'jetbrains-extension/package.json',
      buildGradle: 'jetbrains-extension/build.gradle.kts',
    },
  },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function readVersions() {
  if (!fs.existsSync(VERSIONS_FILE)) {
    die(`未找到 ${VERSIONS_FILE}`);
  }
  return readJson(VERSIONS_FILE);
}

function writeVersions(versions) {
  writeJson(VERSIONS_FILE, versions);
}

function die(message) {
  console.error(`错误: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`用法:
  node scripts/version.mjs list
  node scripts/version.mjs get <chrome|vscode|desktop|jetbrains>
  node scripts/version.mjs set <product> <semver>
  node scripts/version.mjs bump <product> patch|minor|major [--print]
  node scripts/version.mjs sync [product|all]

版本源: versions.json`);
}

function resolveProduct(name) {
  if (!name || name === 'all') {
    return name ?? 'all';
  }
  if (!PRODUCTS[name]) {
    die(`未知产品 "${name}"，可选: ${Object.keys(PRODUCTS).join(', ')}`);
  }
  return name;
}

function bumpSemver(version, level) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(version);
  if (!match) {
    die(`无效 semver: ${version}`);
  }
  let [major, minor, patch] = match.slice(1, 4).map(Number);
  switch (level) {
    case 'major':
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      break;
    case 'patch':
      patch += 1;
      break;
    default:
      die(`无效 bump 级别 "${level}"，可选: patch, minor, major`);
  }
  return `${major}.${minor}.${patch}`;
}

function setPackageVersion(relPath, version) {
  const abs = path.join(ROOT, relPath);
  const pkg = readJson(abs);
  pkg.version = version;
  writeJson(abs, pkg);
}

function setTauriVersion(relPath, version) {
  const abs = path.join(ROOT, relPath);
  const conf = readJson(abs);
  conf.version = version;
  writeJson(abs, conf);
}

function setCargoVersion(relPath, version) {
  const abs = path.join(ROOT, relPath);
  const text = fs.readFileSync(abs, 'utf8');
  const re = /^version = "[^"]*"/m;
  if (!re.test(text)) {
    die(`无法在 ${relPath} 中找到 package version 字段`);
  }
  const next = text.replace(re, `version = "${version}"`);
  fs.writeFileSync(abs, next);
}

function setGradleVersion(relPath, version) {
  const abs = path.join(ROOT, relPath);
  const text = fs.readFileSync(abs, 'utf8');
  const re = /^version = "[^"]*"/m;
  if (!re.test(text)) {
    die(`无法在 ${relPath} 中找到 version 字段`);
  }
  const next = text.replace(re, `version = "${version}"`);
  fs.writeFileSync(abs, next);
}

function syncProduct(product, version) {
  const meta = PRODUCTS[product];
  const { paths } = meta;

  setPackageVersion(paths.packageJson, version);

  if (paths.tauriConf) {
    setTauriVersion(paths.tauriConf, version);
  }
  if (paths.cargoToml) {
    setCargoVersion(paths.cargoToml, version);
  }
  if (paths.buildGradle) {
    setGradleVersion(paths.buildGradle, version);
  }

  console.log(`  ✓ ${product} → ${version}`);
}

function syncDocsAfterChange() {
  syncAllDocs(readVersions());
}

function cmdList() {
  const versions = readVersions();
  for (const [key, meta] of Object.entries(PRODUCTS)) {
    console.log(`${key.padEnd(8)} ${versions[key] ?? '-'}  (${meta.label})`);
  }
}

function cmdGet(product) {
  product = resolveProduct(product);
  const versions = readVersions();
  if (!versions[product]) {
    die(`versions.json 缺少 ${product}`);
  }
  console.log(versions[product]);
}

function cmdSet(product, version) {
  product = resolveProduct(product);
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    die(`版本号格式无效: ${version}`);
  }
  const versions = readVersions();
  versions[product] = version;
  writeVersions(versions);
  syncProduct(product, version);
  syncDocsAfterChange();
  console.log(`已设置 ${product} = ${version} 并同步到子项目`);
}

function cmdBump(product, level, printOnly) {
  product = resolveProduct(product);
  const versions = readVersions();
  const current = versions[product];
  if (!current) {
    die(`versions.json 缺少 ${product}`);
  }
  const next = bumpSemver(current, level);
  if (printOnly) {
    console.log(next);
    return;
  }
  versions[product] = next;
  writeVersions(versions);
  syncProduct(product, next);
  syncDocsAfterChange();
  console.log(`已 bump ${product}: ${current} → ${next}`);
}

function cmdSync(target) {
  target = resolveProduct(target ?? 'all');
  const versions = readVersions();
  console.log('同步 versions.json → 子项目…');
  const products = target === 'all' ? Object.keys(PRODUCTS) : [target];
  for (const product of products) {
    const version = versions[product];
    if (!version) {
      die(`versions.json 缺少 ${product}`);
    }
    syncProduct(product, version);
  }
  syncDocsAfterChange();
  console.log('完成');
}

function main() {
  const [command, arg1, arg2, arg3] = process.argv.slice(2);

  switch (command) {
    case 'list':
      cmdList();
      break;
    case 'get':
      if (!arg1) die('缺少 product');
      cmdGet(arg1);
      break;
    case 'set':
      if (!arg1 || !arg2) die('用法: set <product> <version>');
      cmdSet(arg1, arg2);
      break;
    case 'bump': {
      if (!arg1 || !arg2) die('用法: bump <product> patch|minor|major [--print]');
      cmdBump(arg1, arg2, arg3 === '--print');
      break;
    }
    case 'sync':
      cmdSync(arg1 ?? 'all');
      break;
    default:
      usage();
      process.exit(command ? 1 : 0);
  }
}

const isCliEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  main();
}

export { PRODUCTS, readVersions, bumpSemver };
