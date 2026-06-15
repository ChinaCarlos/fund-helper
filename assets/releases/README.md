# 桌面端发布产物

安装包由 **GitHub Actions** 在云端构建（macOS Apple Silicon + Windows x64）。

> **Releases 页为何是空的？**  
> [github.com/ChinaCarlos/fund-helper/releases](https://github.com/ChinaCarlos/fund-helper/releases) 只有在 **Desktop Release** workflow **成功跑完** 后才会出现安装包。Workflow 不会随普通 commit 自动触发，需打 tag 或手动 Run workflow。

## 当前版本 0.1.0

| 项 | 链接 |
|----|------|
| 构建进度 | [Actions → Desktop Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml) |
| 下载页（CI 完成后） | [Release desktop-v0.1.0](https://github.com/ChinaCarlos/fund-helper/releases/tag/desktop-v0.1.0) |

| 平台 | 文件名 |
|------|--------|
| macOS | `Fund-Helper-0.1.0-macos.dmg` |
| Windows | `Fund-Helper-0.1.0-windows-setup.exe` |

## 触发 CI 构建

### 方式 A — 打 tag（推荐）

```bash
git tag -a desktop-v0.1.0 -m "Desktop 0.1.0"
git push origin desktop-v0.1.0
```

### 方式 B — GitHub 网页

1. 打开 [Desktop Release 工作流](https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml)
2. **Run workflow** → `version` 填 `0.1.0`
3. 等待绿色 ✓ 后打开 [Releases](https://github.com/ChinaCarlos/fund-helper/releases)

### 方式 C — 脚本

```bash
brew install gh && gh auth login
chmod +x publish-desktop.sh
./publish-desktop.sh 0.1.0 --release
```

## 拉到本地（可选）

CI 完成后：

```bash
./publish-desktop.sh 0.1.0 --collect
```

保存到 `assets/releases/v0.1.0/`（该目录在 `.gitignore` 中，不提交 Git）。

---

## VS Code 扩展（vscode-v*）

### 安装

| 编辑器 | 方式 | 地址 |
|--------|------|------|
| **VS Code** | [Marketplace](https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode) | 搜索 **Fund Helper** |
| **Cursor / Trae / CodeBuddy / Qoder** | VSIX | https://github.com/ChinaCarlos/fund-helper/raw/main/assets/releases/vscode/v0.1.0/fund-helper-vscode-0.1.0.vsix |

仓库内 VSIX：[`vscode/v0.1.0/fund-helper-vscode-0.1.0.vsix`](./vscode/v0.1.0/fund-helper-vscode-0.1.0.vsix)

非 VS Code：`Cmd+Shift+P` → **Extensions: Install from VSIX…**

安装说明：[vscode-extension/README.md](../vscode-extension/README.md#安装)

### 维护者：更新仓库内 VSIX

```bash
./publish-vscode.sh 0.1.0 --local
git add assets/releases/vscode/v0.1.0/
git commit -m "chore(vscode): bundle v0.1.0 vsix"
```

### 触发 CI / Marketplace

```bash
./publish-vscode.sh 0.1.0 --release
export VSCE_PAT=xxx && ./publish-vscode.sh 0.1.0 --marketplace
```
