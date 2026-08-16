# @deepseek-ai/dsh-client-ui-files

[English](README.md) | 中文

会话页头「文件」动作与右侧检查器的「文件」Tab。页头文件夹控件调用 `ctx.conversation.openInspector('files')` 和 `ctx.layout.openDetails()`。该 Tab 通过 `ctx.workspaces.listEntries`（`host.listEntries`）列出一层目录：面包屑、文件与目录混合行、隐藏项开关，以及截断。默认路径是当前 Session 的 `cwd`；点击目录和面包屑写入该 Session 的 `dsh.files.browse` store。文件行仅在浏览器为回环且 `host.describe.canOpenPath` 为真时调用 `ctx.workspaces.openPath`；否则该行禁用，并沿用现有「无桌面」文案。

本包不 import workspace 选择器或 browse 对话框组件。`host.listDirectory` 仍只列文件夹。没有 git 状态、文件系统监视、栏内编辑器，也没有创建／重命名／删除。关闭该列会把最后路径和检查器 Tab id 留在各自的 Session store 里。行为由 [带 Tab 的右侧检查器 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-right-sidebar-tabbed-inspector.md) 规定。

## 模型体验

无，因为本包为人类列出宿主文件系统路径，从不触及 prompt、消息、schema、流或工具结果。

#### KV Cache effect

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- **列表是一次性读取** —— agent 新写的文件要等下一次列表才出现。没有监视，也没有 git 装饰。
- **面包屑可以走到 `cwd` 之上** —— MVP 与 browse 对话框一致。以后可用围栏把列表限制在 workspace 路径内。
- **远程-only host 上 `openPath` 不可用** —— 该行保持可见并禁用，沿用「无桌面」文案。
