#!/usr/bin/env bash
# Fund Helper VS Code / Cursor 扩展发版
#
# 用法:
#   ./publish-vscode.sh [版本号] [--local|--release|--collect|--marketplace]
#
# 模式（默认 --local）:
#   --local         本地构建 .vsix → assets/releases/vscode/v{版本}/
#   --release       触发 GitHub Actions 构建并发布 GitHub Release（推荐）
#   --collect       从最近一次 CI 下载 .vsix 到 assets/releases/vscode/
#   --marketplace   构建并推送到 VS Code Marketplace（需 VSCE_PAT）
#
# 示例:
#   ./publish-vscode.sh 0.1.0              # 本地打包
#   ./publish-vscode.sh 0.1.0 --release    # 触发 CI + GitHub Release
#   ./publish-vscode.sh 0.1.0 --marketplace  # 上架 Marketplace
#
# Marketplace 前置:
#   1. https://marketplace.visualstudio.com/ 创建 Publisher（与 package.json publisher 一致）
#   2. https://dev.azure.com/ → Personal Access Token（Marketplace: Manage）
#   3. export VSCE_PAT=xxxx

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT="$ROOT/vscode-extension"
RELEASES_DIR="$ROOT/assets/releases/vscode"
GITHUB_REPO="${GITHUB_REPO:-ChinaCarlos/fund-helper}"
WORKFLOW="vscode-release.yml"

VERSION="${1:-}"
MODE="${2:---local}"

if [[ -z "$VERSION" ]]; then
  VERSION="$(node -p "require('$EXT/package.json').version")"
fi

TAG="vscode-v${VERSION}"
VSIX_NAME="fund-helper-vscode-${VERSION}.vsix"
OUT="$RELEASES_DIR/v${VERSION}"

log() { printf '==> %s\n' "$*"; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

sync_version() {
  log "同步版本号 → ${VERSION}（vscode-extension/package.json）"
  node <<EOF
const fs = require('fs');
const pkgPath = '$EXT/package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
EOF
}

ensure_deps() {
  if [[ ! -d "$EXT/node_modules" ]]; then
    log "安装依赖…"
    (cd "$ROOT" && pnpm install --filter fund-helper-vscode)
  fi
}

build_vsix() {
  local out_file="$1"
  ensure_deps
  log "构建 extension + webview…"
  (cd "$EXT" && pnpm run build)
  log "打包 VSIX → ${out_file}"
  mkdir -p "$(dirname "$out_file")"
  (cd "$EXT" && npx --yes @vscode/vsce@latest package \
    --no-dependencies \
    --githubBranch main \
    --baseImagesUrl "https://raw.githubusercontent.com/${GITHUB_REPO}/main/vscode-extension" \
    --out "$out_file")
  log "VSIX 大小: $(du -h "$out_file" | cut -f1)"
}

write_manifest() {
  mkdir -p "$OUT"
  cat > "$OUT/manifest.json" <<EOF
{
  "version": "${VERSION}",
  "tag": "${TAG}",
  "repo": "${GITHUB_REPO}",
  "artifacts": {
    "vsix": "${VSIX_NAME}"
  },
  "downloadPath": "assets/releases/vscode/v${VERSION}/${VSIX_NAME}",
  "downloadRaw": "https://github.com/${GITHUB_REPO}/raw/main/assets/releases/vscode/v${VERSION}/${VSIX_NAME}",
  "downloadRelease": "https://github.com/${GITHUB_REPO}/releases/download/${TAG}/${VSIX_NAME}",
  "marketplace": "https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode",
  "publisher": "fund-helper-org",
  "extensionId": "fund-helper-org.fund-helper-vscode",
  "install": "VS Code / Cursor → Cmd+Shift+P → Extensions: Install from VSIX…"
}
EOF
}

build_local() {
  sync_version
  mkdir -p "$OUT"
  build_vsix "$OUT/$VSIX_NAME"
  write_manifest
  cat <<EOF

本地 VSIX 已生成:
  ${OUT}/${VSIX_NAME}

安装:
  Cursor / VS Code → Cmd+Shift+P → Extensions: Install from VSIX…

提交到仓库（供用户 clone / 直链下载）:
  git add assets/releases/vscode/v${VERSION}/
  git commit -m "chore(vscode): bundle v${VERSION} vsix"

EOF
}

release_ci() {
  sync_version

  log "触发 GitHub Actions: ${WORKFLOW} (version=${VERSION})"

  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    gh workflow run "$WORKFLOW" \
      --repo "$GITHUB_REPO" \
      -f "version=${VERSION}"
    log "已提交 workflow，等待构建…"
    log "进度: gh run list --workflow=${WORKFLOW} --repo ${GITHUB_REPO}"
    log "完成后下载: ./publish-vscode.sh ${VERSION} --collect"
    log "Release 页: https://github.com/${GITHUB_REPO}/releases/tag/${TAG}"
    print_download_hint
    return
  fi

  cat <<EOF

未检测到 gh 或未登录。请任选一种方式触发 CI：

【方式 A】GitHub 网页
  1. 打开 https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW}
  2. Run workflow → version = ${VERSION}
  3. 完成后在 Releases 下载 ${VSIX_NAME}

【方式 B】命令行
  brew install gh && gh auth login
  ./publish-vscode.sh ${VERSION} --release

【方式 C】打 tag 触发（需先 commit 并 push 含版本号的代码）
  git add vscode-extension/package.json
  git commit -m "chore(vscode): release ${VERSION}"
  git tag -a ${TAG} -m "VS Code extension ${VERSION}"
  git push origin main ${TAG}

EOF
  print_download_hint
}

collect_ci() {
  command -v gh >/dev/null 2>&1 || die "需要 GitHub CLI: brew install gh && gh auth login"

  local run_id
  run_id="$(gh run list --workflow="$WORKFLOW" --repo "$GITHUB_REPO" --limit 5 --json databaseId,status,conclusion --jq '.[] | select(.status=="completed" and .conclusion=="success") | .databaseId' | head -1)"
  [[ -n "$run_id" && "$run_id" != "null" ]] || die "未找到已成功的 vscode-release 运行记录，请先 --release"

  log "下载 workflow run #${run_id}"
  rm -rf "$OUT"
  mkdir -p "$OUT/_dl"
  gh run download "$run_id" --repo "$GITHUB_REPO" --dir "$OUT/_dl"

  local vsix
  vsix="$(find "$OUT/_dl" -name '*.vsix' | head -1)"
  [[ -n "$vsix" ]] || die "下载产物中未找到 .vsix 文件"

  mv "$vsix" "$OUT/$VSIX_NAME"
  rm -rf "$OUT/_dl"
  write_manifest
  log "已保存到 $OUT/$VSIX_NAME"
  print_download_hint
}

publish_marketplace() {
  [[ -n "${VSCE_PAT:-}" ]] || die "请设置 VSCE_PAT（Azure DevOps PAT，权限 Marketplace → Manage）"

  sync_version
  ensure_deps
  log "构建并发布到 VS Code Marketplace（publisher: fund-helper-org）…"
  (cd "$EXT" && pnpm run build)
  (cd "$EXT" && npx --yes @vscode/vsce@latest publish \
    --no-dependencies \
    --githubBranch main \
    --baseImagesUrl "https://raw.githubusercontent.com/${GITHUB_REPO}/main/vscode-extension" \
    -p "$VSCE_PAT")

  cat <<EOF

已提交 Marketplace 发布（通常数分钟内生效）:
  https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode

Cursor 用户也可在扩展市场搜索 "Fund Helper"。

EOF
}

print_download_hint() {
  cat <<EOF

GitHub Releases:
  https://github.com/${GITHUB_REPO}/releases/tag/${TAG}

  文件: ${VSIX_NAME}

EOF
}

case "$MODE" in
  --local|--pack) build_local ;;
  --release|--ci) release_ci ;;
  --collect) collect_ci ;;
  --marketplace|--publish) publish_marketplace ;;
  --help|-h) sed -n '2,22p' "$0" ;;
  *) die "未知模式: ${MODE}（可用 --local | --release | --collect | --marketplace）" ;;
esac
