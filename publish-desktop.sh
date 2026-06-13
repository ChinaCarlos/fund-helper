#!/usr/bin/env bash
# Fund Helper 桌面端发包 — 推荐走 GitHub Actions 双平台构建
#
# 用法:
#   ./publish-desktop.sh [版本号] [--release|--collect|--local]
#
# 模式（默认 --release）:
#   --release   触发 GitHub Actions 构建 macOS + Windows 并发布 Release（推荐）
#   --collect   从最近一次 CI 下载产物到 assets/releases/
#   --local     仅本机构建当前平台（开发调试用，Mac 无法 cross-compile Windows）
#
# 示例:
#   ./publish-desktop.sh 0.1.0              # 等同 --release
#   ./publish-desktop.sh 0.1.0 --collect    # 下载 CI 产物

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DESKTOP="$ROOT/desktop"
RELEASES_DIR="$ROOT/assets/releases"
GITHUB_REPO="${GITHUB_REPO:-ChinaCarlos/fund-helper}"
WORKFLOW="desktop-release.yml"

VERSION="${1:-}"
MODE="${2:---release}"

if [[ -z "$VERSION" ]]; then
  VERSION="$(node -p "require('$DESKTOP/package.json').version")"
fi

TAG="desktop-v${VERSION}"
OUT="$RELEASES_DIR/v${VERSION}"

log() { printf '==> %s\n' "$*"; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

sync_version() {
  log "同步版本号 → ${VERSION}"
  node <<EOF
const fs = require('fs');
const pkgPath = '$DESKTOP/package.json';
const tauriPath = '$DESKTOP/src-tauri/tauri.conf.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
tauri.version = '$VERSION';
fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');
EOF
  local cargo="$DESKTOP/src-tauri/Cargo.toml"
  if grep -q '^version = ' "$cargo"; then
    sed -i.bak "s/^version = \".*\"/version = \"${VERSION}\"/" "$cargo"
    rm -f "${cargo}.bak"
  fi
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
    log "完成后下载: ./publish-desktop.sh ${VERSION} --collect"
    log "Release 页: https://github.com/${GITHUB_REPO}/releases/tag/${TAG}"
    return
  fi

  cat <<EOF

未检测到 gh 或未登录。请任选一种方式触发 CI：

【方式 A】GitHub 网页（无需 gh）
  1. 打开 https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW}
  2. 点击 Run workflow，填写 version = ${VERSION}
  3. 构建完成后在 Releases 下载安装包

【方式 B】命令行
  brew install gh && gh auth login
  ./publish-desktop.sh ${VERSION} --release

【方式 C】打 tag 触发（需先 commit 并 push 代码）
  git tag -a ${TAG} -m "Desktop ${VERSION}"
  git push origin ${TAG}

EOF
}

collect_ci() {
  command -v gh >/dev/null 2>&1 || die "需要 GitHub CLI: brew install gh && gh auth login"

  local run_id
  run_id="$(gh run list --workflow="$WORKFLOW" --repo "$GITHUB_REPO" --limit 1 --json databaseId,status --jq '.[] | select(.status=="completed") | .databaseId' | head -1)"
  [[ -n "$run_id" && "$run_id" != "null" ]] || die "未找到已完成的 desktop-release 运行记录，请先 --release 或稍后再试"

  log "下载 workflow run #${run_id}"
  rm -rf "$OUT"
  mkdir -p "$OUT/macos" "$OUT/windows"
  gh run download "$run_id" --repo "$GITHUB_REPO" --dir "$OUT/_dl"

  find "$OUT/_dl" -name '*.dmg' | while read -r f; do
    cp "$f" "$OUT/macos/Fund-Helper-${VERSION}-macos.dmg"
  done
  find "$OUT/_dl" -name '*setup*.exe' -o -name '*.exe' | head -1 | while read -r f; do
    [[ -n "$f" ]] && cp "$f" "$OUT/windows/Fund-Helper-${VERSION}-windows-setup.exe"
  done
  rm -rf "$OUT/_dl"

  write_manifest
  log "已保存到 $OUT"
}

write_manifest() {
  mkdir -p "$OUT"
  cat > "$OUT/manifest.json" <<EOF
{
  "version": "${VERSION}",
  "tag": "${TAG}",
  "repo": "${GITHUB_REPO}",
  "artifacts": {
    "macos": "macos/Fund-Helper-${VERSION}-macos.dmg",
    "windows": "windows/Fund-Helper-${VERSION}-windows-setup.exe"
  },
  "downloadBase": "https://github.com/${GITHUB_REPO}/releases/download/${TAG}"
}
EOF
}

build_local() {
  die "本地双平台打包不可用（Mac 无法 cross-compile Windows）。请使用: ./publish-desktop.sh ${VERSION} --release"
}

print_download_urls() {
  cat <<EOF

GitHub Releases 下载:
  https://github.com/${GITHUB_REPO}/releases/tag/${TAG}

  macOS:   Fund-Helper-${VERSION}-macos.dmg
  Windows: Fund-Helper-${VERSION}-windows-setup.exe

EOF
}

case "$MODE" in
  --release|--ci) release_ci ;;
  --collect) collect_ci; print_download_urls ;;
  --local|--local-only) build_local ;;
  --help|-h) sed -n '2,18p' "$0" ;;
  *) die "未知模式: ${MODE}（可用 --release | --collect | --local）" ;;
esac
