# 桌面端发布产物

本目录用于存放 **Fund Helper 桌面端** 安装包（本地构建或从 CI 拉取）。

> 二进制安装包默认不提交 Git；请通过 [GitHub Releases](https://github.com/ChinaCarlos/fund-helper/releases) 下载，或使用 `./publish-desktop.sh` 本地生成。

## 目录结构

```
assets/releases/
├── README.md                 # 本说明
└── v0.1.0/                   # 按版本号分目录（本地构建输出）
    ├── manifest.json         # 版本与下载 URL 元数据
    ├── macos/
    │   └── Fund-Helper-0.1.0-macos.dmg
    └── windows/
        └── Fund-Helper-0.1.0-windows-setup.exe
```

## 下载地址（GitHub Releases）

| 平台 | 文件 | 链接 |
|------|------|------|
| macOS（Universal，Apple Silicon + Intel） | `Fund-Helper-{version}-macos.dmg` | [最新版](https://github.com/ChinaCarlos/fund-helper/releases/latest) |
| Windows（x64） | `Fund-Helper-{version}-windows-setup.exe` | [最新版](https://github.com/ChinaCarlos/fund-helper/releases/latest) |

固定版本示例（`desktop-v0.1.0` tag）：

- macOS: https://github.com/ChinaCarlos/fund-helper/releases/download/desktop-v0.1.0/Fund-Helper-0.1.0-macos.dmg
- Windows: https://github.com/ChinaCarlos/fund-helper/releases/download/desktop-v0.1.0/Fund-Helper-0.1.0-windows-setup.exe

## 维护者发包

```bash
chmod +x publish-desktop.sh

# 本机仅打当前平台（Mac 上 → .dmg）
./publish-desktop.sh 0.1.0 --local

# 双平台 CI 发布（打 tag desktop-v0.1.0，需 gh login）
./publish-desktop.sh 0.1.0 --release

# 从 CI 拉取产物到本目录
./publish-desktop.sh 0.1.0 --collect
```
