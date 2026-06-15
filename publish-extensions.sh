#!/usr/bin/env bash
# Fund Helper 扩展统一发版入口（Chrome + VS Code + JetBrains）
#
# 用法:
#   ./publish-extensions.sh              # 交互式菜单
#   ./publish-extensions.sh list
#   ./publish-extensions.sh bump chrome patch
#   ./publish-extensions.sh chrome --release
#   ./publish-extensions.sh vscode --local
#   ./publish-extensions.sh jetbrains --release
#   ./publish-extensions.sh all --release
#
# 也可使用 pnpm:
#   pnpm release:extensions
#   pnpm release:chrome -- --release
#   pnpm release:vscode -- --marketplace
#   pnpm release:jetbrains -- --release

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
exec node "$ROOT/scripts/release.mjs" "$@"
