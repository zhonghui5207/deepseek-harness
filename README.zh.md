# DSH Desktop

[English](README.md) | 中文

<p align="center">
  <img src="apps/desktop/build/icon.png" alt="DSH Desktop 黑鲸鱼图标" width="168" height="168">
</p>

<p align="center">
  <a href="https://github.com/zhonghui5207/deepseek-harness-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/zhonghui5207/deepseek-harness-desktop?display_name=tag" alt="最新版本"></a>
  <a href="https://github.com/zhonghui5207/deepseek-harness-desktop/actions/workflows/desktop-release.yml"><img src="https://github.com/zhonghui5207/deepseek-harness-desktop/actions/workflows/desktop-release.yml/badge.svg" alt="Desktop Release"></a>
</p>

DSH Desktop 把 DeepSeek Harness Web 界面和运行时打包成可安装的 Electron 应用。Harness 运行时、工作区、会话、工具与模型路由均在本地运行；模型请求会发送到用户配置的模型提供方端点。

## 下载

从 [GitHub Releases](https://github.com/zhonghui5207/deepseek-harness-desktop/releases/latest) 下载当前安装包与归档。

| 平台 | 推荐文件 | 架构 |
|---|---|---|
| macOS | `.dmg` | Apple Silicon（`arm64`） |
| Windows | `.exe` | `x64` |
| Linux | `.AppImage` | `x86_64` |

当前安装包尚未签名或公证。macOS Gatekeeper 与 Windows SmartScreen 可能显示警告；确认信任下载文件后，请先检查 Release，再使用操作系统提供的明确打开操作。

<a id="run"></a>

## 安装与配置

1. 下载对应平台的安装包。在 macOS 上打开 DMG 并把 DSH Desktop 移到“应用程序”；在 Windows 上运行安装程序；在 Linux 上先为 AppImage 添加可执行权限，再启动它。
2. 打开**设置 → 模型**，添加要使用的 API 端点与模型路由。
3. 新建会话，选择已配置模型，再选择工作区目录。

使用 OCX Local Gateway 等 OpenAI 兼容本地网关时，配置通常类似：

```text
API URL: http://127.0.0.1:10100/v1
API protocol: openai-responses
Model ID: provider/model-name
```

协议必须与网关实际实现的端点一致，模型 ID 也必须与该网关返回的 ID 一致。请通过应用设置保存凭据，绝不要把凭据提交到仓库。

## 本地数据

Desktop 与 `dsh` CLI 使用同一个 Harness home：设置 `$DSH_HOME` 时使用该目录，否则使用 `~/.dsh`。因此设置、凭据引用、会话、模型路由与 profile 可以在两个界面间继续使用。该目录包含本地应用状态，也可能引用凭据，请妥善保护。

renderer 运行在沙箱中，只连接 Desktop 进程持有的回环服务器。应用不会把该服务器暴露给局域网。

## 更新

每个发布版本都会分别为 macOS、Windows 与 Linux 构建并执行冒烟测试。Desktop 启动后会检查仓库中公开可见的 Latest Release，只有发现较新版本时才会提示。你也可以随时使用**帮助 → 检查更新…**手动检查。

点击**下载更新**会在操作系统浏览器中打开发布页面。应用不会静默下载或替换自身；请通过平台的常规流程安装所选安装包。安装包完成签名与公证前，不启用全自动安装。

<a id="run-from-source"></a>

## 开发

本仓库采用 monorepo，因为 Desktop 应用与 Harness 运行时目前从同一个源码 commit 发布。Desktop 的架构、安全模型、打包命令与已知限制见 [Desktop 包参考](apps/desktop/README.md)。

```sh
git clone https://github.com/zhonghui5207/deepseek-harness-desktop.git
cd deepseek-harness-desktop
pnpm install
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

贡献者环境与架构说明见[开发指南](docs/development.md)和[架构参考](docs/architecture.md)。

## 许可证与署名

DSH Desktop 是基于 DeepSeek Harness 代码库与 Cordis 构建的社区 Desktop 发行版。仓库使用 [MIT](LICENSE) 许可证，依赖声明保留在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
