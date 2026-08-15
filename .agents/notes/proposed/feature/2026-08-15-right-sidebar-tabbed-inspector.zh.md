# Agent Note: 右侧栏作为带 Tab 的检查栏（文件列表优先）

Status: proposed

[English](2026-08-15-right-sidebar-tabbed-inspector.md) | 中文

## 问题

Web client 已经是三栏：左侧会话导航、中间对话、右侧 `details` 轨道目前只检查一条被选中的工具调用。用户从聊天里做项目时，需要对话旁边持久的文件列表——不是再弹一次目录选择对话框，也不是在左侧会话列表里再塞一棵文件树。

`host.listDirectory` 今天喂不了这份列表。browse 后端会跳过非目录，好让 workspace 选择器只显示能进入的文件夹。Trajectory 检查已经否决过复用全局 details 列，因此新的右侧产品不得把文件浏览折进工具行点击。

## 提案

**复用现有右侧网格轨道，做成带 Tab 的检查栏。插件注册 Tab。MVP 交付「文件」加上现有的工具「详情」。不新增第四条 AppFrame 列，也不把文件树放进左侧边栏。**

### 布局

`AppFrame` 仍是三列。`ctx.layout.openDetails`／`closeDetails` 与让位链（details 先让；关闭时渲染 0px 且保持挂载）仍是几何所有者。切换 Session 仍按 [Web details 跟随当前 Session 生命周期](../../implemented/bug-fix/2026-07-29-web-details-session-lifecycle.md) 关闭右侧轨道。右列保持 `scope: 'session'`：空白 New Session／hero 没有文件列表。

会话页头动作（`conversation.session.header.actions` 里的文件夹图标）打开该列并选中「文件」Tab。已经调用 `openDetails` 的工具检查流继续如此，并选中「详情」Tab。关闭该列不会忘记该 Session store 里的 Tab 身份和文件路径；再次打开会恢复，直到 Session 切换或页面刷新。布局宽度保持瞬时（不写 `localStorage`）。

### Tab

`details` 占用方变成薄 Tab 壳。子贡献走列表 slot（`details.tab`，与 `conversation.view` 同构）：每个插件提供 `id`、`label`、`order` 和正文。MVP 两个 Tab：

- **文件**（`id: 'files'`，order 0）——新的 `ui-files` 插件。
- **详情**（`id: 'details'`，order 10）——今天的 `DetailsPanel` 正文（选中调用的参数 + `conversation.details.tool`）。空态文案仍是「选择一条工具调用」；打开「文件」不要求已有选择。

后续 Tab（产物文件索引、若 Task Surface 以后选中此列）用同一注册方式。中间栏的 Chat／Trajectory Tab 留在会话页头；两套 Tab 不得共用 id 或文案。

### 文件 Tab

根目录是当前 Session 的 `cwd`（工具解析所对的同一根）。列表是一层目录加面包屑，导航姿态对齐 browse 对话框，而不是递归的 VS Code 树。

行同时包含文件和目录。点击目录列出该层；点击文件在 host 报告 `canOpenPath` 时调用 `ctx.workspaces.openPath`（操作系统处理程序），否则该行不可用并沿用现有「无桌面」文案。隐藏项默认不显示，除非用户打开开关。截断沿用 browse 的完整结果上限。MVP 不做 git 状态、文件系统监视、栏内编辑器，也不做创建／重命名／删除。

### Host 列表

不要加宽 `host.listDirectory`。该 RPC 继续只列文件夹，供接纳 workspace 使用。

在现有 `ctx.fs.listDir` 上加一个 Host Consumer（`FsDirEntry` 已带 `file`｜`directory`｜`other`）：新的一元 RPC，例如 `host.listEntries({ path })`，应答面包屑、混合行（`kind` + 名称 + 绝对路径 + 可选 size）、隐藏标记和截断。client 绝不自己拼接路径段。不可读或缺失目标以 `directory-unreadable` 失败。文件 Tab 默认列出 `session.cwd`；面包屑可下钻，MVP 也可上走（browse 对话框已经如此）。以后收紧时可以把列表限制在 workspace 路径内。

### 包

- `ui-layout` —— 不加新列；可选暴露 `toggleDetails`，作为默认宽度下开关的逆操作。
- `ui-conversation` —— Tab 壳占用 `details`；「详情」Tab 正文留在本包。
- `ui-files` —— 「文件」Tab + 页头动作；只通过 `ctx.workspaces`／新列表 RPC 交谈，绝不 import `ui-workspace` 或 `ui-directory-picker-browse` 的组件。
- `host/apiproxy` —— `host.listEntries` 的 schema、handler、fetch carrier。
- Session store（details 或会话页头 store）—— 当前 Tab id + 文件 Tab 的当前路径。

## 已考虑的替代方案

**第四条 AppFrame 列。** 否决：让位链、拖拽手柄和 Session 生命周期几何都按一条右侧轨道规定。第二条右轨会让每条夹紧和自动关闭规则翻倍，只为多一条 Tab。

**把文件树放进左侧边栏。** 否决：左侧是会话／workspace 导航（[Workspace 侧边栏顺序与折叠](../../implemented/feature/2026-08-11-workspace-sidebar-order-and-folding.md)）。把文件混进 `WorkspaceBrowser` 会替换或挤占那棵树。

**原样复用 `host.listDirectory`。** 否决：browse 后端按设计丢掉文件。若 workspace 选择器开始显示文件会是产品缺陷；并行 RPC 让两种列表各司其职。

**在文件 Tab 里做应用内预览／编辑器。** MVP 否决：工具行路径已经走 `openPath`（[工具调用文件用系统打开](../../implemented/feature/2026-07-28-tool-call-file-open-in-os.md)）。编辑器是另一个产品。

**文件系统监视和 git 装饰。** MVP 否决：`listDir` 是一次性列表。监视和状态需要新的 Host 能力以及本 Tab 尚无的刷新策略。

**每次进入 Session 都自动打开右列。** 否决：details 默认关闭；每次切换都占 360px 会抢走中间栏。用户显式打开「文件」。

**把文件列表放进 Trajectory 的局部检查器。** 否决：那是账本行作用域（[trajectory 检查](../../implemented/feature/2026-07-27-trajectory-inspection-ledger.md)）。项目文件列表是 Session 作用域的 chrome。

## 验收标准

- 非空白 Session 下，页头「文件」动作打开右列并落在「文件」Tab，列出 `cwd`（文件和目录）。
- 点击目录导航；点击文件在 host 能打开时走 `openPath`；面包屑走祖先。
- 工具检查仍打开同一列并落在「详情」Tab，且不丢失该 Session 的文件路径状态。
- 切换 Session 关闭该列；hero／New Session 不显示右轨。
- `host.listDirectory` 仍只返回目录；workspace 选择器不显示文件。
- Keyless web e2e 覆盖打开「文件」、下钻一层、关闭，以及检查 → 「详情」Tab。GUI 变更在可做真实服务器录制时附演示 GIF。

## 风险

列出 `cwd` 之上可能暴露 workspace 外的目录；MVP 与 browse 一致，以后可用围栏收紧。远程-only host 上 `openPath` 为空操作。刷新会忘记打开的列（既有布局约定）。没有监视时，agent 新写的文件要等下一次列表才出现。Tab chrome 加上 Chat／Trajectory Tab 可能混淆——「文件／详情」与「Chat／Trajectory」必须保持区分。
