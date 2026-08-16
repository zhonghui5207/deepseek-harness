# Agent Note: 右侧栏作为带 Tab 的检查栏（文件列表优先）

Status: implemented

[English](2026-08-15-right-sidebar-tabbed-inspector.md) | 中文

## 问题

Web client 已经是三栏：左侧会话导航、中间对话、右侧 `details` 轨道目前只检查一条被选中的工具调用。用户从聊天里做项目时，需要对话旁边持久的文件列表——不是再弹一次目录选择对话框，也不是在左侧会话列表里再塞一棵文件树。

`host.listDirectory` 喂不了这份列表。browse 后端会跳过非目录，好让 workspace 选择器只显示能进入的文件夹。Trajectory 检查已经否决过复用全局 details 列，因此右侧文件列表不得折进工具行点击。

## 决策

**现有右侧网格轨道是带 Tab 的检查栏。插件注册 Tab。已交付的 Tab 是「文件」加上现有的工具「详情」。没有第四条 AppFrame 列，也没有把文件树放进左侧边栏。**

### 布局

`AppFrame` 仍是三列。`ctx.layout.openDetails`／`closeDetails` 与让位链（details 先让；关闭时渲染 0px 且保持挂载）仍是几何所有者。切换 Session 仍按 [Web details 跟随当前 Session 生命周期](../../implemented/bug-fix/2026-07-29-web-details-session-lifecycle.md) 关闭右侧轨道。右列保持 `scope: 'session'`：空白 New Session／hero 没有文件列表。

会话页头动作（`conversation.session.header.actions` 里的文件夹图标）打开该列并选中「文件」Tab。`ChatViewInjected.openDetails` 选中「详情」Tab 并打开同一列。关闭该列不会忘记该 Session store 里的 Tab 身份和文件路径；再次打开会恢复，直到 Session 切换或页面刷新。布局宽度保持瞬时（不写 `localStorage`）。

### Tab

`details` 占用方是薄 Tab 壳（`InspectorPanel`）。子贡献走 `details.tab` 列表 slot（与 `conversation.view` 同构）：每个插件提供 `id`、`label`、`order` 和正文。已交付两个 Tab：

- **文件**（`id: 'files'`，order 0）—— [`ui-files`](../../../../packages/client/ui-files/README.md)。
- **详情**（`id: 'details'`，order 10）—— `DetailsPanel`（选中调用的参数 + `conversation.details.tool`）。空态文案仍是「选择一条工具调用」；打开「文件」不要求已有选择。

后续 Tab 用同一注册方式。中间栏的 Chat／Trajectory Tab 留在会话页头；两套 Tab 不共用 id 或文案。

当前 Tab id 放在会话 chat store（`detailsTab`，持久化键 `dsh.conversation.chat`）。`ConversationController.openInspector(tab)` 通过 `bindInspector` 暂存的 slot 缓存 store 实例写入该 id；bind 之前写下的 Tab 会在 details inject 运行时刷出。`defineStore.create()` 不会去重，因此 `ui-files` 不得 import 或重建 chat store。

### 文件 Tab

根目录是当前 Session 的 `cwd`（工具解析所对的同一根）。列表是一层目录加面包屑，导航姿态对齐 browse 对话框，而不是递归树。

行同时包含文件和目录。点击目录列出该层；点击文件在浏览器为回环且 host 报告 `canOpenPath` 时调用 `ctx.workspaces.openPath`，否则该行不可用并沿用现有「无桌面」文案。隐藏项（`name.startsWith('.')`）默认不显示，除非用户打开开关。截断使用 Config 字段 `listEntriesMaxEntries`（默认 1000）。没有 git 状态、文件系统监视、栏内编辑器，也不做创建／重命名／删除。

文件路径和隐藏项偏好放在本包自有 store（`dsh.files.browse`），不放进 chat store，因为 handle 身份不能跨包共享。

### Host 列表

`host.listDirectory` 继续只列文件夹，供接纳 workspace 使用。

`host.listEntries({ path })` 是现有 `ctx.fs.listDir` 上的 Host Consumer（`FsDirEntry` 已带 `file`｜`directory`｜`other`）。路径必填。应答携带面包屑、混合行（`kind` + 名称 + 绝对路径 + 可选 size）、隐藏标记和截断。client 绝不自己拼接路径段。不可读或缺失目标以 `directory-unreadable` 失败。该方法不要求 browse 目录选择能力。缺少 `ctx.fs` 以 `internal` 失败。面包屑可下钻，本交付也可上走（browse 对话框已经如此）。

### 包

- `ui-layout` —— 不加新列。
- `ui-conversation` —— Tab 壳占用 `details`；「详情」Tab 正文留在本包；`IConversation.openInspector` 只选 Tab，不打开该列。
- `ui-files` —— 「文件」Tab + 页头动作；只通过 `ctx.workspaces`／`host.listEntries` 交谈，绝不 import `ui-workspace` 或 `ui-directory-picker-browse` 的组件。
- `host/apiproxy` —— `host.listEntries` 的 schema、handler、fetch carrier，以及 `listEntriesMaxEntries` Config。
- 会话 chat store —— 当前 Tab id。Files store —— 当前路径和隐藏开关。

## 已考虑的替代方案

**第四条 AppFrame 列。** 否决：让位链、拖拽手柄和 Session 生命周期几何都按一条右侧轨道规定。第二条右轨会让每条夹紧和自动关闭规则翻倍，只为多一条 Tab。

**把文件树放进左侧边栏。** 否决：左侧是会话／workspace 导航（[Workspace 侧边栏顺序与折叠](../../implemented/feature/2026-08-11-workspace-sidebar-order-and-folding.md)）。把文件混进 `WorkspaceBrowser` 会替换或挤占那棵树。

**原样复用 `host.listDirectory`。** 否决：browse 后端按设计丢掉文件。若 workspace 选择器开始显示文件会是产品缺陷；并行 RPC 让两种列表各司其职。

**在文件 Tab 里做应用内预览／编辑器。** 否决：工具行路径已经走 `openPath`（[工具调用文件用系统打开](../../implemented/feature/2026-07-28-tool-call-file-open-in-os.md)）。编辑器是另一个产品。

**文件系统监视和 git 装饰。** 否决：`listDir` 是一次性列表。监视和状态需要新的 Host 能力以及本 Tab 尚无的刷新策略。

**每次进入 Session 都自动打开右列。** 否决：details 默认关闭；每次切换都占 360px 会抢走中间栏。用户显式打开「文件」。

**把文件列表放进 Trajectory 的局部检查器。** 否决：那是账本行作用域（[trajectory 检查](../../implemented/feature/2026-07-27-trajectory-inspection-ledger.md)）。项目文件列表是 Session 作用域的 chrome。

## 后果

列出 `cwd` 之上可能暴露 workspace 外的目录；本交付与 browse 一致，以后可用围栏收紧。远程-only host 上 `openPath` 为空操作。刷新会忘记打开的列（既有布局约定）。没有监视时，agent 新写的文件要等下一次列表才出现。Tab chrome 加上 Chat／Trajectory Tab 靠文案保持区分：「文件／详情」对 Chat／Trajectory。

`ChatViewInjected.openDetails` 会选中「详情」并打开该列，但组装后的工具行没有调用该 face。页头「文件」动作是已交付的入口；该列打开后可通过检查器 Tab 条到达「详情」。

## 测试

无密钥覆盖：api-proxy 上的 `host.listEntries`（混合行、截断、不可读、中止）以及 client `IWorkspaces` 线路；检查器 Tab 壳（选择 + 关闭）；文件面板（cwd 列表、隐藏开关、目录下钻、不可用文件、不可读）；会话 `openInspector` 的 bind／pending；web e2e 在已播种 Session 上打开「文件」、下钻一层、关闭，并切换到「详情」。browse fixture 里 `host.listDirectory` 仍只列文件夹。
