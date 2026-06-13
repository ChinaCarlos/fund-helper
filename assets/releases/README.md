# 桌面端发布产物

安装包由 **GitHub Actions** 在云端构建（macOS Universal + Windows x64），**无需在本机 cross-compile**。

> 二进制默认不提交 Git；从 [GitHub Releases](https://github.com/ChinaCarlos/fund-helper/releases) 下载。

## 下载地址

| 平台 | 文件 | 链接 |
|------|------|------|
| macOS（Universal） | `Fund-Helper-{version}-macos.dmg` | [最新 Release](https://github.com/ChinaCarlos/fund-helper/releases/latest) |
| Windows（x64） | `Fund-Helper-{version}-windows-setup.exe` | [最新 Release](https://github.com/ChinaCarlos/fund-helper/releases/latest) |

## 维护者：触发 CI 构建

### 方式 A — 命令行（推荐）

```bash
brew install gh && gh auth login   # 首次
chmod +x publish-desktop.sh

./publish-desktop.sh 0.1.0 --release   # 触发 Actions
./publish-desktop.sh 0.1.0 --collect # 下载到 assets/releases/v0.1.0/
```

### 方式 B — GitHub 网页

1. 打开 [Desktop Release 工作流](https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml)
2. 点击 **Run workflow**，填写 `version`（如 `0.1.0`）
3. 等待完成后在 [Releases](https://github.com/ChinaCarlos/fund-helper/releases) 下载

### 方式 C — 打 tag

```bash
git tag -a desktop-v0.1.0 -m "Desktop 0.1.0"
git push origin desktop-v0.1.0
```

## 本地目录（可选）

`--collect` 会将 CI 产物保存为：

```
assets/releases/v0.1.0/
├── manifest.json
├── macos/Fund-Helper-0.1.0-macos.dmg
└── windows/Fund-Helper-0.1.0-windows-setup.exe
```
