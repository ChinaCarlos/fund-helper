#!/usr/bin/env bash
# Fund Helper 桌面端发包脚本
#
# 用法:
#   ./publish-desktop.sh [版本号] [--local|--release|--collect]
#
# 模式:
#   --local     仅在本机构建当前平台，产物复制到 assets/releases/v{版本}/
#   --release   打 tag 并推送，触发 GitHub Actions 构建 macOS + Windows（需 gh、git 写权限）
#   --collect   从最近一次 Desktop Release 工作流下载产物到 assets/releases/
#
# 示例:
#   ./publish-desktop.sh 0.1.0 --local          # Mac 上本地打 macOS 包
#   ./publish-desktop.sh 0.1.0 --release        # CI 双平台发布到 GitHub Releases
#   ./publish-desktop.sh 0.1.0 --collect        # 拉取 CI 产物到 assets/

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DESKTOP="$ROOT/desktop"
RELEASES_DIR="$ROOT/assets/releases"
GITHUB_REPO="${GITHUB_REPO:-ChinaCarlos/fund-helper}"

VERSION="${1:-}"
MODE="${2:---local}"

if [[ -z "$VERSION" ]]; then
  VERSION="$(node -p "require('$DESKTOP/package.json').version")"
fi

TAG="desktop-v${VERSION}"
OUT="$RELEASES_DIR/v${VERSION}"
BUNDLE_DIR="$DESKTOP/src-tauri/target/release/bundle"

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

install_deps() {
  log "安装前端依赖"
  (cd "$DESKTOP" && pnpm install --frozen-lockfile)
}

build_local() {
  install_deps
  log "Tauri 构建（本机平台）"
  (cd "$DESKTOP" && pnpm tauri:build)

  mkdir -p "$OUT/macos" "$OUT/windows"

  local copied=0
  while IFS= read -r -d '' file; do
    local name
    name="$(basename "$file")"
    case "$name" in
      *.dmg)
        cp "$file" "$OUT/macos/Fund-Helper-${VERSION}-macos.dmg"
        copied=1
        log "macOS: $OUT/macos/Fund-Helper-${VERSION}-macos.dmg"
        ;;
      *.app.tar.gz|*.app)
        cp "$file" "$OUT/macos/"
        copied=1
        ;;
    esac
  done < <(find "$BUNDLE_DIR" -type f \( -name '*.dmg' -o -name '*.app.tar.gz' \) -print0 2>/dev/null || true)

  while IFS= read -r -d '' file; do
    cp "$file" "$OUT/windows/Fund-Helper-${VERSION}-windows-setup.exe"
    copied=1
    log "Windows: $OUT/windows/Fund-Helper-${VERSION}-windows-setup.exe"
  done < <(find "$BUNDLE_DIR" -type f \( -name '*setup*.exe' -o -name '*.msi' \) -print0 2>/dev/null || true)

  if [[ "$copied" -eq 0 ]]; then
    die "未找到安装包，请检查 $BUNDLE_DIR"
  fi

  write_manifest
  log "完成。产物目录: $OUT"
}

write_manifest() {
  cat > "$OUT/manifest.json" <<EOF
{
  "version": "${VERSION}",
  "tag": "${TAG}",
  "repo": "${GITHUB_REPO}",
  "artifacts": {
    "macos": "Fund-Helper-${VERSION}-macos.dmg",
    "windows": "Fund-Helper-${VERSION}-windows-setup.exe"
  },
  "downloadBase": "https://github.com/${GITHUB_REPO}/releases/download/${TAG}"
}
EOF
}

release_ci() {
  command -v gh >/dev/null 2>&1 || die "需要 GitHub CLI (gh)，安装: brew install gh"
  gh auth status >/dev/null 2>&1 || die "请先 gh auth login"

  sync_version

  log "创建并推送 tag: ${TAG}"
  git -C "$ROOT" tag -a "$TAG" -m "Desktop release ${VERSION}" 2>/dev/null || git -C "$ROOT" tag -f "$TAG" -m "Desktop release ${VERSION}"
  git -C "$ROOT" push origin "$TAG"

  log "已触发 GitHub Actions 构建 macOS + Windows"
  log "查看进度: gh run list --workflow=desktop-release.yml --repo ${GITHUB_REPO}"
  log "发布后下载页: https://github.com/${GITHUB_REPO}/releases/tag/${TAG}"
}

collect_ci() {
  command -v gh >/dev/null 2>&1 || die "需要 GitHub CLI (gh)"

  local run_id
  run_id="$(gh run list --workflow=desktop-release.yml --repo "$GITHUB_REPO" --limit 1 --json databaseId --jq '.[0].databaseId')"
  [[ -n "$run_id" && "$run_id" != "null" ]] || die "未找到 desktop-release 工作流运行记录"

  log "下载 workflow run #${run_id} 产物"
  rm -rf "$OUT"
  mkdir -p "$OUT"
  gh run download "$run_id" --repo "$GITHUB_REPO" --dir "$OUT"

  # 归一化文件名
  find "$OUT" -name '*.dmg' -exec sh -c 'mv "$1" "$(dirname "$1")/Fund-Helper-'"${VERSION}"'-macos.dmg"' _ {} \; 2>/dev/null || true
  find "$OUT" -name '*setup*.exe' -o -name '*.exe' | head -1 | while read -r f; do
    mv "$f" "$OUT/Fund-Helper-${VERSION}-windows-setup.exe" 2>/dev/null || true
  done

  write_manifest
  log "已保存到 $OUT"
}

print_download_urls() {
  cat <<EOF

下载地址（GitHub Releases）:
  macOS:   https://github.com/${GITHUB_REPO}/releases/download/${TAG}/Fund-Helper-${VERSION}-macos.dmg
  Windows: https://github.com/${GITHUB_REPO}/releases/download/${TAG}/Fund-Helper-${VERSION}-windows-setup.exe

本地目录:
  ${OUT}/

EOF
}

case "$MODE" in
  --local|--local-only)
    sync_version
    build_local
    print_download_urls
    ;;
  --release|--ci)
    release_ci
    ;;
  --collect)
    collect_ci
    print_download_urls
    ;;
  --help|-h)
    sed -n '2,20p' "$0"
    ;;
  *)
    die "未知模式: ${MODE}（可用 --local | --release | --collect）"
    ;;
esac
