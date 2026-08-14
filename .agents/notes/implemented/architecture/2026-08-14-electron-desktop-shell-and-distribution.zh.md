# Agent Note: Electron Desktop 留在 monorepo，并通过临时回环端口复用 Web profile

Status: implemented

[English](2026-08-14-electron-desktop-shell-and-distribution.md) | 中文

## 问题

最初的 Electron 入口可以打开 Web UI，但还不是可分发应用：它使用固定端口，没有单实例与有上限的关闭语义，启动错误只能从终端看到，也没有安装包或发布 workflow。打包还会暴露只加载 Web 外壳无法发现的问题。Electron Builder 不会从 monorepo 的环境链接中恢复必需的 workspace 对等依赖闭包，而系统 Agent preset 是应用资产，不属于 Web bundle patch。因此可执行应用可能成功提供 SPA，却缺少创建和恢复 session 所需的插件包或全部 preset 组合。

仓库归属也是产品设计的一部分。Desktop 当前消费内部 profile 组合包、客户端插件 bundle、Loader 行为，并与核心使用同一发布版本。此时从独立仓库发布会要求维护第二份依赖 manifest，并在没有版本化集成边界的情况下协调兼容性变更。

## 决定

**即使公共仓库使用面向 Desktop 的名称，Desktop 仍是 `apps/desktop` 下的应用。**它与 Harness 包从同一个 commit 发布。GitHub 安装包与归档是面向最终用户的分发面；npm 包只是打包输入。`desktop-v<version>` tag 必须与应用 manifest 一致，并且只有在所有原生构建与打包冒烟测试通过后，才会发布包含校验和且公开可见的 Latest Release。手动运行 Desktop Release 会生成用于测试的工作流产物。只有当 Desktop 消费稳定且带版本的公共 runtime 或 carrier API，并能独立发布时，才考虑拆分源码仓库。

**Electron 主进程在进程内启动随附的 `web` profile。**它不会生成 CLI 子进程。启动器拥有的 overlay 把 `dsh-host-webserver` 绑定到 `127.0.0.1` 和端口 `0`，窗口再加载该服务实际分配的 URL。这样可以复用已验证的 HTTP／WebSocket 协议、前端 dist、设置、凭据、session 与插件名录，同时不会发生固定端口冲突。IPC carrier 仍可作为未来的传输替换，但不是交付可用 Desktop 应用的前置条件。

**renderer 是无特权 Web 客户端。**它启用 Chromium 沙箱与上下文隔离，关闭 Node 集成，也没有 preload 桥。同源应用导航留在窗口内；HTTP(S) 链接交给操作系统浏览器；`file:`、`javascript:` 等 scheme 不会被委托。文件系统、shell、沙箱与模型操作继续通过主进程中的现有 host route 提供。

**Electron 生命周期适配共用的有上限关闭控制器。**一个实例持有 Harness 配置树；第二次启动会聚焦已有实例。退出、Windows／Linux 上关闭最后一个窗口、配置树请求退出以及 signal 都汇聚到等待 Cordis dispose 的路径，并受五秒上限约束；重复中断或卡死的 disposer 会升级为立即退出。macOS 在关闭最后一个窗口后保留进程和配置树，并在再次激活时重建窗口。没有终端可见时，原生错误对话框会展示启动与 renderer 加载失败。

**可执行应用 manifest 持有完整 workspace 对等依赖闭包和已安装应用资产。**Desktop 依赖 `@deepseek-ai/dsh`，由它唯一提供安装后的 `config/agent-presets`；启动器把该目录覆盖为系统根，并在打开窗口前验证 `code`、`cordis`、`minimal` 与 `standard`。`verify-runtime-closure` 同时检查 Desktop manifest 与 Python runtime carrier。发布 workflow 随后使用全新的 Harness home 启动真正的未封装可执行文件，并分别通过每个系统 preset 创建 session，从而发现只检查外壳无法发现的资产或漏包。Linux workflow 会在该冒烟开始前恢复 Electron 未封装的 `chrome-sandbox` helper 的 root 所有权与 `4755` 模式，以匹配安装后的 helper，而不是关闭 Chromium 沙箱。`asar` 保持关闭，因为 profile fallback 符号链接与 Loader 解析需要真实包目录；在这些机制拥有适配归档的安装表示之前，这是一项明确选择。

## 影响

- 用户可以在 macOS、Windows 或 Linux 上安装同一套 Web 模型路由 UI，无需打开浏览器，也无需手工管理本地服务器。
- 新建和恢复的 session 使用与 `dsh web` 相同的已安装系统 preset 组合；preset 安装不完整会在 Desktop 启动时失败，而不是等到用户交互后才暴露。
- Desktop 与 `dsh web` 共用 `$DSH_HOME`，因此任一表层配置的模型路由与凭据都会在重启后直接出现在另一表层。
- renderer 仍连接进程本地回环服务器。它不增加局域网暴露，但也不是 IPC 安全边界，传输收敛留待以后处理。
- 预览版包含黑鲸鱼应用图标，但仍未签名、未公证，没有更新器，并且每个发布 runner 只构建一个原生架构。
- Desktop 在启动时加载用户 patch 层，但尚未调用 `watchUserPatches`；这些文件变更后需要重启。
- 应用保留在 monorepo，避免过早稳定公共 API；这也意味着在未来有意拆分归属前，Desktop 发布会跟随核心 commit。

## 曾考虑的替代方案

- **现在创建独立仓库**：拒绝，因为当前所有集成依赖都是内部且版本耦合的；拆分只会增加同步工作，不会隔离出稳定 API。
- **发布前先使用 `file://` 加 Electron IPC carrier**：暂缓，因为这需要为完整请求／下行传输和静态模块加载路径再实现一套方案。临时回环已经运行生产 Web 组合，同时保持 renderer 沙箱化。
- **把 `dsh web` 作为子进程启动**：拒绝，因为这会重复进程归属、信号处理、配置诊断和生命周期协调，还会让错误报告更间接。
- **保留专用固定端口**：拒绝，因为 CLI／Desktop 同时启动或残留进程都可能冲突；操作系统已经提供安全的临时端口分配。
- **只通过 npm 分发**：拒绝，因为 Electron 应用对用户的约定是安装包或平台归档，而不是 Node 包管理器工作流。
- **在 Desktop 中复制第二份 preset 目录**：拒绝，因为两份应用资产可能发生漂移；两个启动器都以已安装的 `@deepseek-ai/dsh` 包为唯一来源。
- **立即启用 `asar`**：暂缓，因为用户 home 下的 profile fallback 链接必须指向文件系统目录，动态导入插件还包含原生模块；适配归档的布局需要单独设计与打包测试。

## 模型体验

没有新增模型可见内容。Desktop 挂载与 `dsh web` 相同的 `dsh-web-app` 提示词段落和提供方组合；本决定只改变应用托管与分发。

#### KV Cache 影响

除现有 Web profile 外没有影响，因为 Desktop 壳不会添加请求内容。
