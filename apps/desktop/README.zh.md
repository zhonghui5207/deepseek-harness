# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

DeepSeek Harness Web 表层的可安装 Electron 壳。Electron 主进程在进程内启动与 `dsh web` 相同的 `web` profile，通过 overlay 把 `webserver` 绑定到 `127.0.0.1` 并让操作系统分配端口，再用一个沙箱窗口加载实际 URL。renderer 使用 `sandbox: true` 与上下文隔离，不启用 Node 集成，也没有 preload 桥；文件系统、shell、session、设置、凭据和模型提供方均留在主进程。导航被限制在应用同源范围，普通 HTTP(S) 链接交给操作系统浏览器，非 Web scheme 则被拒绝。

Desktop 与 CLI 使用同一个 Harness home：优先取 `$DSH_HOME`，否则使用 `~/.dsh`。因此 profile、`settings.yaml`、`.credentials.yaml`、session 和模型路由无需 Desktop 专用迁移即可共用。在 Windows 与 Linux 上关闭最后一个窗口会退出；macOS 会保留应用，并在再次激活时重建窗口。单实例锁会聚焦已有窗口，所有退出路径都会先给 Cordis 配置树一个有上限的优雅关闭窗口，再退出 Electron。

## 开发与打包

全新 checkout 启动前需先构建仓库，因为 Web profile 会提供已构建的前端 dist：

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

可以生成用于本地检查的未封装应用，也可以生成当前平台的安装包／归档目标：

```sh
pnpm --filter @deepseek-ai/dsh-desktop run dist:dir
pnpm --filter @deepseek-ai/dsh-desktop run smoke:packaged
pnpm --filter @deepseek-ai/dsh-desktop run dist
```

本包 manifest（元数据清单）有意列出 Web profile 所需的完整 workspace 对等依赖闭包，并依赖 `@deepseek-ai/dsh` 唯一提供安装后的 `config/agent-presets`。Desktop 启动时把该目录挂为系统 preset 根；缺少 `code`、`cordis`、`minimal` 或 `standard` 的安装会被直接拒绝。Electron Builder 不会从 monorepo 的环境链接中物化 workspace peer，因此 `pnpm run verify-runtime-closure` 会检查可执行闭包。打包冒烟使用全新的临时 Harness home 启动真正的未封装可执行文件，并分别通过每个系统 preset 创建 session，覆盖与“新建会话”和冷恢复相同的路径。Linux 冒烟开始前，发布 workflow 会把 Electron 未封装的 `chrome-sandbox` helper 设置为安装后的 root 所有权与 `4755` 模式，而不会关闭 Chromium 沙箱。

`asar` 目前保持关闭，因为 profile fallback 链接和 Cordis Loader 导入需要已安装应用中的真实包目录。因此安装包是面向用户的支持产物；npm 包只是发布输入，不是最终用户安装方式。

## 分发与仓库归属

[`Desktop Release`](../../.github/workflows/desktop-release.yml) 会构建原生 macOS、Windows 与 Linux 安装包，对每个未封装应用做冒烟测试，再上传安装包与归档。`desktop-v<version>` tag 必须与本包 manifest 中的版本完全一致；所有原生任务通过后，工作流会把这些文件和 `SHA256SUMS.txt` 发布为仓库中可见的 Latest Release。手动运行工作流只生成可下载的工作流产物。

Desktop 目前保留在本 monorepo。它的 profile 组合包、客户端模块、Loader 行为和发布版本都随 Harness 核心一起变化；此时拆分独立仓库只会复制依赖 manifest，并要求每次兼容性变更跨仓库协调，却没有形成稳定边界。只有当 Desktop 能消费带版本的公共 runtime／carrier API，并产生真正独立的发布节奏时，才值得拆分。

## 模型体验

Desktop 挂载与 `dsh web` 相同的 `dsh-web-app` 组合包和模型可见 Web 表层上下文；它不增加 Desktop 专用提示词，也不改变提供方行为。模型选择与路由仍来自共用的设置层和 profile 层。

#### KV Cache 影响

除 `dsh-web-app` 已有影响外没有新增影响；Desktop 壳不会向模型请求添加内容。

## 已知限制与暂缓事项

- **预览产物未签名、未公证**：macOS Gatekeeper 与 Windows SmartScreen 可能警告。各平台安装包均包含黑鲸鱼应用图标。
- **没有自动更新**：需要手动安装新版 GitHub Release。
- **Desktop 不监听用户 patch 文件**：home 级或 profile 的 `cordis.patch.yml` 发生变化后需要重启应用；客户端 bundle 的 HMR 在其独立重建 watcher 运行时仍可工作。
- **renderer 当前使用回环 HTTP／WebSocket**：尚未使用 `file://` renderer 或 Electron IPC carrier。服务器绑定到临时端口上的 `127.0.0.1`，不会向局域网开放。
- **`asar` 已关闭**：未封装依赖树体积更大，但保留了可由文件系统寻址的插件包与原生模块。
- **每个发布 runner 只构建自身原生架构**：通用二进制与其他架构需要扩展发布矩阵。
