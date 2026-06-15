# 客户端发布产物

Chrome / VS Code / Desktop 三个客户端的安装包均由 **GitHub Actions** 构建。版本号统一由根目录 **`versions.json`** + **`scripts/version.mjs`** 管理。

## 版本管理（统一入口）

| 命令 | 说明 |
|------|------|
| `pnpm version:list` | 查看三个客户端当前版本 |
| `pnpm version:sync` | 将 `versions.json` 同步到各子项目 |
| `pnpm version:bump chrome patch` | 自动 patch 并同步（vscode / desktop 同理） |
| `node scripts/version.mjs set chrome 1.0.1` | 指定版本并同步 |

发版脚本不传版本号时，会自动读取 `versions.json` 中对应产品的版本。

### 扩展统一发版 CLI（Chrome + VS Code）

```bash
./publish-extensions.sh              # 交互式菜单
pnpm release:extensions              # 同上

# 命令行
node scripts/release.mjs list
node scripts/release.mjs bump chrome patch
node scripts/release.mjs chrome --release
node scripts/release.mjs vscode --local
node scripts/release.mjs all --release    # 两者同时触发 CI
```

---

## Chrome 浏览器插件（chrome-v*）

<!-- fund-helper:version:chrome -->
| 项 | 链接 |
|----|------|
| 当前版本 | `1.0.0`（见 `versions.json`） |
| 构建 | [Actions → Chrome Extension Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/chrome-release.yml) |
| 下载 | [Release chrome-v1.0.0](https://github.com/ChinaCarlos/fund-helper/releases/tag/chrome-v1.0.0) |
<!-- /fund-helper:version:chrome -->

**触发 CI：**

```bash
node scripts/version.mjs bump chrome patch   # 或 set chrome 1.0.1
./publish-chrome.sh --release                # 或 ./publish-chrome.sh 1.0.1 --release
# 或打 tag: git tag -a chrome-v1.0.1 && git push origin chrome-v1.0.1
```

**本地打包：**

```bash
./publish-chrome.sh --local
```

产物：`fund-helper-chrome-{version}.zip`（解压后 `chrome://extensions` 加载已解压扩展）

---

## 桌面端（desktop-v*）

<!-- fund-helper:version:desktop -->
| 项 | 链接 |
|----|------|
| 当前版本 | `0.1.0` |
| 构建 | [Actions → Desktop Release](https://github.com/ChinaCarlos/fund-helper/actions/workflows/desktop-release.yml) |
| 下载 | [Release desktop-v0.1.0](https://github.com/ChinaCarlos/fund-helper/releases/tag/desktop-v0.1.0) |

| 平台 | 文件名 |
|------|--------|
| macOS（Universal） | `Fund-Helper-0.1.0-macos.dmg` |
| Windows | `Fund-Helper-0.1.0-windows-setup.exe` |
<!-- /fund-helper:version:desktop -->

```bash
./publish-desktop.sh --release
./publish-desktop.sh 0.1.0 --collect   # CI 完成后下载到本地
```

---

## VS Code 扩展（vscode-v*）

<!-- fund-helper:version:vscode -->
| 项 | 链接 |
|----|------|
| 当前版本 | `0.1.2` |
| Marketplace | [Fund Helper](https://marketplace.visualstudio.com/items?itemName=fund-helper-org.fund-helper-vscode) |
| VSIX 下载 | [Release vscode-v0.1.2](https://github.com/ChinaCarlos/fund-helper/releases/tag/vscode-v0.1.2) |
<!-- /fund-helper:version:vscode -->

```bash
./publish-vscode.sh --local              # 本地 VSIX
./publish-vscode.sh --release            # 触发 CI
export VSCE_PAT=xxx && ./publish-vscode.sh --marketplace
```

非 VS Code 编辑器：`Cmd+Shift+P` → **Extensions: Install from VSIX…**

安装说明：[vscode-extension/README.md](../vscode-extension/README.md#安装)
