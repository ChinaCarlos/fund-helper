#!/usr/bin/env bash
# Fund Helper Chrome 浏览器插件发版
#
# 用法:
#   ./publish-chrome.sh [版本号] [--local|--release|--collect]
#
# 模式（默认 --local）:
#   --local     本地构建 zip → assets/releases/chrome/v{版本}/
#   --release   触发 GitHub Actions 构建并发布 GitHub Release
#   --collect   从最近一次 CI 下载 zip 到 assets/releases/chrome/
#
# 示例:
#   ./publish-chrome.sh                    # 使用 versions.json 中的 chrome 版本本地打包
#   ./publish-chrome.sh 1.0.1 --release   # 触发 CI + GitHub Release
#
# 版本管理（统一入口）:
#   node scripts/version.mjs list
#   node scripts/version.mjs bump chrome patch
#   node scripts/version.mjs set chrome 1.0.1

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CHROME="$ROOT/chrome-extension"
RELEASES_DIR="$ROOT/assets/releases/chrome"
GITHUB_REPO="${GITHUB_REPO:-ChinaCarlos/fund-helper}"
WORKFLOW="chrome-release.yml"

VERSION=""
MODE="--local"

if [[ $# -ge 1 && "$1" == --* ]]; then
  MODE="$1"
elif [[ $# -ge 1 ]]; then
  VERSION="$1"
  MODE="${2:---local}"
fi

if [[ -z "$VERSION" ]]; then
  VERSION="$(node "$ROOT/scripts/version.mjs" get chrome)"
fi

TAG="chrome-v${VERSION}"
ZIP_NAME="fund-helper-chrome-${VERSION}.zip"
OUT="$RELEASES_DIR/v${VERSION}"

log() { printf '==> %s\n' "$*"; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

sync_version() {
  log "同步版本号 → ${VERSION}（versions.json + chrome-extension）"
  node "$ROOT/scripts/version.mjs" set chrome "$VERSION"
}

ensure_deps() {
  if [[ ! -d "$ROOT/node_modules" ]]; then
    log "安装依赖…"
    (cd "$ROOT" && pnpm install --filter fund-helper-extension)
  fi
}

build_zip() {
  local out_file="$1"
  ensure_deps
  log "构建 Chrome 扩展…"
  (cd "$ROOT" && pnpm --filter fund-helper-extension build)
  log "打包 ZIP → ${out_file}"
  mkdir -p "$(dirname "$out_file")"
  rm -f "$out_file"
  (cd "$CHROME/dist" && zip -r "$out_file" .)
  log "ZIP 大小: $(du -h "$out_file" | cut -f1)"
  unzip -l "$out_file" | grep -F 'manifest.json' || die "ZIP 缺少 manifest.json"
}

write_manifest() {
  mkdir -p "$OUT"
  cat > "$OUT/manifest.json" <<EOF
{
  "version": "${VERSION}",
  "tag": "${TAG}",
  "repo": "${GITHUB_REPO}",
  "artifacts": {
    "zip": "${ZIP_NAME}"
  },
  "downloadPath": "assets/releases/chrome/v${VERSION}/${ZIP_NAME}",
  "downloadRelease": "https://github.com/${GITHUB_REPO}/releases/download/${TAG}/${ZIP_NAME}",
  "install": "解压 zip → chrome://extensions → 加载已解压的扩展程序"
}
EOF
}

build_local() {
  sync_version
  mkdir -p "$OUT"
  build_zip "$OUT/$ZIP_NAME"
  write_manifest
  cat <<EOF

本地 Chrome 扩展包已生成:
  ${OUT}/${ZIP_NAME}

安装:
  1. 解压 zip 到任意目录
  2. chrome://extensions → 开发者模式 → 加载已解压的扩展程序

提交到仓库（可选）:
  git add assets/releases/chrome/v${VERSION}/
  git commit -m "chore(chrome): bundle v${VERSION}"

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
    log "完成后下载: ./publish-chrome.sh ${VERSION} --collect"
    log "Release 页: https://github.com/${GITHUB_REPO}/releases/tag/${TAG}"
    print_download_hint
    return
  fi

  cat <<EOF

未检测到 gh 或未登录。请任选一种方式触发 CI：

【方式 A】GitHub 网页
  1. 打开 https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW}
  2. Run workflow → version = ${VERSION}
  3. 完成后在 Releases 下载 ${ZIP_NAME}

【方式 B】命令行
  brew install gh && gh auth login
  ./publish-chrome.sh ${VERSION} --release

【方式 C】打 tag 触发（需先 commit 并 push 含版本号的代码）
  git add versions.json chrome-extension/package.json
  git commit -m "chore(chrome): release ${VERSION}"
  git tag -a ${TAG} -m "Chrome extension ${VERSION}"
  git push origin main ${TAG}

EOF
  print_download_hint
}

collect_ci() {
  command -v gh >/dev/null 2>&1 || die "需要 GitHub CLI: brew install gh && gh auth login"

  local run_id
  run_id="$(gh run list --workflow="$WORKFLOW" --repo "$GITHUB_REPO" --limit 5 --json databaseId,status,conclusion --jq '.[] | select(.status=="completed" and .conclusion=="success") | .databaseId' | head -1)"
  [[ -n "$run_id" && "$run_id" != "null" ]] || die "未找到已成功的 chrome-release 运行记录，请先 --release"

  log "下载 workflow run #${run_id}"
  rm -rf "$OUT"
  mkdir -p "$OUT/_dl"
  gh run download "$run_id" --repo "$GITHUB_REPO" --dir "$OUT/_dl"

  local zip
  zip="$(find "$OUT/_dl" -name '*.zip' | head -1)"
  [[ -n "$zip" ]] || die "下载产物中未找到 .zip 文件"

  mv "$zip" "$OUT/$ZIP_NAME"
  rm -rf "$OUT/_dl"
  write_manifest
  log "已保存到 $OUT/$ZIP_NAME"
  print_download_hint
}

print_download_hint() {
  cat <<EOF

GitHub Releases:
  https://github.com/${GITHUB_REPO}/releases/tag/${TAG}

  文件: ${ZIP_NAME}

EOF
}

case "$MODE" in
  --local|--pack) build_local ;;
  --release|--ci) release_ci ;;
  --collect) collect_ci ;;
  --help|-h) sed -n '2,22p' "$0" ;;
  *) die "未知模式: ${MODE}（可用 --local | --release | --collect）" ;;
esac
