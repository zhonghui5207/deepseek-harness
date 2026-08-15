# Agent Note: 会话置顶

Status: implemented

[English](2026-08-15-session-pin-to-top.md) | 中文

## 问题

用户需要微信式的会话粘性置顶：被置顶的聊天会话留在其所在分组（以及单列表）的顶部，直到用户取消置顶。最近更新、Last updated 提升和 Host 手动会话顺序都不得打乱该位置。这不是活动置顶（已删除的 `touchSession` 链），也不是归档：会话保持可见。

Ungrouped 会话不属于任何 workspace 实体，per-workspace 字段放不下置顶记录。Last updated 已经会在浏览器本地记账里把会话提升一次；第二条 Host 持久权威必须叠在该视图顺序之上，且不得改写 `WorkspaceView.sessionIds`。

## 决策

**置顶顺序是 workspace domain 全局单例（`workspaceDomainState.pinnedSessionIds`）上的新字段，后置顶的在前，覆盖在 workspace 记账之上；显示分区收敛在 client 的 `tree.ts` 派生层、落在既有视图顺序之后；wire 面沿用归档已有的全快照姿态。**

- 存储：`pinnedSessionIds: z.array(sessionId).default([])`，domain version 保持 2——纯新增字段，旧介质经 schema default 解析为空列表。置顶绝不改动 `sessionIds`，因此不参与「一个会话只被一个 workspace 记账」不变式。归档已置顶会话时，同一次写入也会把它从该顺序中移除。
- 注册表：`ctx.workspaceRegistry.pinSession(id)`／`unpinSession(id)` 走 `enqueueOperation`。置顶既非实时也未持久化的会话抛带 `action: 'pin'` 的 `WorkspaceUnknownSessionError`；已置顶 id 不写盘不发事件。取消置顶对未置顶 id 为空操作，且不要求会话仍然存在。`pinnedSessionIds` getter 暴露只读顺序。
- RPC：`workspace.pinSession({sessionId})`／`workspace.unpinSession({sessionId})` 应答 `{pinnedSessionIds}`（完整更新后顺序）；`workspace.list` 携带该顺序作为重连基线；`host/pinned-sessions-changed` 在每次持久变更后推完整快照（与 `host/archived-sessions-changed` 同姿态，从 `domain/changed` 的 global put 分支按顺序比对推帧）。未知置顶目标复用 `session-not-found`。
- client 运行时：`WorkspaceListState.pinnedSessionIds`（后置顶在前的 `readonly SessionId[]`，成员或位置不变不换引用）。list 基线、一元回声、changed 帧三路都用完整顺序整体替换。帧／回声落在 in-flight `workspace.list` 期间时屏蔽旧基线对新顺序的回滚。
- UI：会话行菜单增加「置顶会话」／「取消置顶」；置顶行带一枚小图钉。`deriveGroups`／`deriveFlat`／单列表记账调和在全局置顶顺序之后分区：置顶 id 在前，其余行保持既有视图顺序，因此 Last updated 提升不能把未置顶行抬到置顶行之上。置顶行不可拖拽；未置顶拖拽保持原语义。搜索排序不变。

这是用户粘性置顶。[Session 列表浏览与 Workspace 手动排序](2026-07-25-session-list-browsing-and-manual-order.md)删除了 Host 账本上的活动置顶。[Workspace 侧边栏顺序与折叠](2026-08-11-workspace-sidebar-order-and-folding.md)拥有浏览器本地记账的 Last updated 提升。归档仍是隐藏路径（[会话归档](2026-07-31-session-archive-global-set.md)）。

## 已考虑的替代方案

**用 Last updated／新近度代替粘性置顶。** 否决：用户要的是取消置顶之前一直留在顶部，而不是下一次 prompt 就能打乱的一次性提升。

**per-workspace `pinnedSessionIds`。** 否决：Ungrouped 会话无落点，与归档改为全局的理由相同。

**在每个分组上方单开「置顶」区头。** MVP 否决：在既有分组／单列表内部分区更接近微信的列表内置顶，且不必新增导航地标。

**置顶行之间拖拽，或置顶重排 RPC。** MVP 否决：后置顶前置已够用；置顶行不可拖拽，避免落点落到置顶分区内部。

**在 `SessionSummary` 上打 `archived`／`pinned` 标。** 否决：要把 workspace domain 事实 join 进 sessions domain 投影，summary 无增量帧还得另发通知。

**增量帧（pinned/unpinned 单条）。** 否决：列表极小、变更频率低，全快照免去 client 侧合并逻辑，并与归档和 workspace-changed 姿态一致。

## 后果

置顶顺序由 Host 持久，并在标签页与刷新之间共享。尚无置顶重排 UI；要改相对顺序只能取消置顶再置顶（后置顶前置）。置顶行不可拖拽；未置顶拖拽仍写入原来的 Host 或浏览器本地记账，显示在该记账顺序之后重新分区。搜索结果不做置顶分区。`workspace.list` 增加 `pinnedSessionIds` 是 pre-release 直改。

## 测试

领域测试覆盖前置、已置顶空操作、取消置顶、归档剥离置顶、未知 id 拒绝、跨重启恢复与旧介质默认。Host 测试覆盖 RPC、置顶时的 `session-not-found`、list 基线与 changed 帧。运行时测试覆盖一元回声、帧安装与 in-flight 基线屏蔽。UI 测试覆盖菜单置顶／取消置顶、图钉、分组与单列表分区，以及 Last updated 不把未置顶行抬到置顶行之上。workspace-management e2e 钉住装配后的全链路（置顶 → 持久顺序 → reload 后仍置顶 → 取消置顶）。
