#!/usr/bin/env bash
# Fund Helper JetBrains 插件发版
#
# 用法:
#   ./publish-jetbrains.sh [版本号] [--local|--release|--collect]
#
# 模式（默认 --local）:
#   --local     本地 Gradle 打包 → assets/releases/jetbrains/v{版本}/
#   --release   触发 GitHub Actions 构建并发布 GitHub Release（推荐）
#   --collect   从最近一次 CI 下载 zip 到 assets/releases/jetbrains/
#
# 示例:
#   ./publish-jetbrains.sh                    # 使用 versions.json 版本，本地打包
#   ./publish-jetbrains.sh 0.1.0 --local      # 指定版本本地打包
#   ./publish-jetbrains.sh --release          # 触发 CI
#   ./publish-jetbrains.sh 0.1.0 --collect    # 下载 CI 产物
#
# 前置:
#   - JDK 17+（本地 --local）
#   - pnpm（构建 webview）
#   - gh CLI（--release / --collect，可选）

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT="$ROOT/jetbrains-extension"
RELEASES_DIR="$ROOT/assets/releases/jetbrains"
GITHUB_REPO="${GITHUB_REPO:-ChinaCarlos/fund-helper}"
WORKFLOW="jetbrains-release.yml"

VERSION=""
MODE="--local"

if [[ $# -ge 1 && "$1" == --* ]]; then
  MODE="$1"
elif [[ $# -ge 1 ]]; then
  VERSION="$1"
  MODE="${2:---local}"
fi

if [[ -z "$VERSION" ]]; then
  VERSION="$(node "$ROOT/scripts/version.mjs" get jetbrains)"
fi

TAG="jetbrains-v${VERSION}"
ZIP_NAME="fund-helper-jetbrains-${VERSION}.zip"
OUT="$RELEASES_DIR/v${VERSION}"

log() { printf '==> %s\n' "$*"; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

sync_version() {
  log "同步版本号 → ${VERSION}（versions.json + jetbrains-extension）"
  node "$ROOT/scripts/version.mjs" set jetbrains "$VERSION"
}

ensure_java() {
  if ! command -v java >/dev/null 2>&1; then
    die "未找到 Java。请安装 JDK 17+ 并设置 JAVA_HOME"
  fi
}

build_zip() {
  local out_file="$1"
  ensure_java
  log "安装 monorepo 依赖（含 jetbrains webview）…"
  (cd "$ROOT" && pnpm install --frozen-lockfile)
  log "构建 webview…"
  (cd "$ROOT" && pnpm --filter fund-helper-jetbrains-webview run build:webview)
  log "Gradle buildPlugin…"
  (cd "$EXT" && ./gradlew buildPlugin --no-daemon -q -x buildWebview -x installWebviewDeps)
  local built="$EXT/build/distributions/$ZIP_NAME"
  [[ -f "$built" ]] || die "未找到构建产物: $built"
  mkdir -p "$(dirname "$out_file")"
  cp "$built" "$out_file"
  log "插件包大小: $(du -h "$out_file" | cut -f1)"
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
  "downloadPath": "assets/releases/jetbrains/v${VERSION}/${ZIP_NAME}",
  "downloadRaw": "https://github.com/${GITHUB_REPO}/raw/main/assets/releases/jetbrains/v${VERSION}/${ZIP_NAME}",
  "downloadRelease": "https://github.com/${GITHUB_REPO}/releases/download/${TAG}/${ZIP_NAME}",
  "install": "Settings → Plugins → ⚙ → Install Plugin from Disk…"
}
EOF
}

build_local() {
  sync_version
  mkdir -p "$OUT"
  build_zip "$OUT/$ZIP_NAME"
  write_manifest
  cat <<EOF

本地插件包已生成:
  ${OUT}/${ZIP_NAME}

安装:
  JetBrains IDE → Settings → Plugins → ⚙ → Install Plugin from Disk…

提交到仓库（供 clone / 直链下载）:
  git add assets/releases/jetbrains/v${VERSION}/
  git commit -m "chore(jetbrains): bundle v${VERSION} plugin zip"

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
    log "完成后下载: ./publish-jetbrains.sh ${VERSION} --collect"
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
  ./publish-jetbrains.sh ${VERSION} --release

【方式 C】打 tag 触发（需先 commit 并 push 含版本号的代码）
  git add versions.json jetbrains-extension/
  git commit -m "chore(jetbrains): release ${VERSION}"
  git tag -a ${TAG} -m "JetBrains plugin ${VERSION}"
  git push origin main ${TAG}

EOF
  print_download_hint
}

collect_ci() {
  command -v gh >/dev/null 2>&1 || die "需要 GitHub CLI: brew install gh && gh auth login"

  local run_id
  run_id="$(gh run list --workflow="$WORKFLOW" --repo "$GITHUB_REPO" --limit 5 --json databaseId,status,conclusion --jq '.[] | select(.status=="completed" and .conclusion=="success") | .databaseId' | head -1)"
  [[ -n "$run_id" && "$run_id" != "null" ]] || die "未找到已成功的 jetbrains-release 运行记录，请先 --release"

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
  --help|-h) sed -n '2,23p' "$0" ;;
  *) die "未知模式: ${MODE}（可用 --local | --release | --collect）" ;;
esac
