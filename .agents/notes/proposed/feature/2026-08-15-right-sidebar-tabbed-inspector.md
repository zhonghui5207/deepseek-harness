# Agent Note: Right sidebar as a tabbed inspector (Files first)

Status: proposed

English | [中文](2026-08-15-right-sidebar-tabbed-inspector.zh.md)

## Problem

The Web client already has three columns: left session navigation, center conversation, and a right `details` track that only inspects one selected tool call. Users working a project from chat need a persistent file list next to the conversation — not another modal directory picker, and not a second tree fighting the left session list.

`host.listDirectory` cannot feed that list today. The browse backend skips non-directories so the workspace picker only shows folders a user can enter. Trajectory inspection already rejected reusing the global details column, so a new right-hand product must not collapse file browsing into tool-row clicks.

## Proposal

**Reuse the existing right grid track as a tabbed inspector chrome. Plugins register tabs. MVP ships Files plus the current tool Details. Do not add a fourth AppFrame column, and do not put a file tree in the left sidebar.**

### Layout

`AppFrame` stays three columns. `ctx.layout.openDetails` / `closeDetails` and the concession chain (details yields first; closed details render 0px and stay mounted) stay the geometry owner. Session-switch still closes the right track per [Web details follow the current Session lifecycle](../../implemented/bug-fix/2026-07-29-web-details-session-lifecycle.md). The right column remains `scope: 'session'`: a blank New Session / hero has no file list.

A session-header action (folder glyph in `conversation.session.header.actions`) opens the column and selects the Files tab. Tool-inspect flows that already call `openDetails` keep doing so and select the Details tab. Closing the column forgets neither tab identity nor the last Files path inside that Session store; a later open restores them until the Session changes or the page reloads. Layout widths stay transient (no `localStorage`).

### Tabs

The `details` occupant becomes a thin tab shell. Child contributions use a list slot (`details.tab`, parallel to `conversation.view`): each plugin supplies `id`, `label`, `order`, and a body. Two MVP tabs:

- **Files** (`id: 'files'`, order 0) — new `ui-files` plugin.
- **Details** (`id: 'details'`, order 10) — today's `DetailsPanel` body (selected call args + `conversation.details.tool`). Empty copy stays “select a tool call”; opening Files does not require a selection.

Later tabs (produced-file index, Task Surface if it later chooses this column) register the same way. Center Chat / Trajectory tabs stay on the conversation header; the two tab rings must not share ids or copy.

### Files tab

Root is the current Session `cwd` (the same root tools resolve against). The list is one directory level plus crumbs, matching the browse dialog's navigation, not a recursive VS Code tree.

Rows include files and directories. Clicking a directory lists that level; clicking a file calls `ctx.workspaces.openPath` (OS handler) when the host reports `canOpenPath`, otherwise the row is inert with the existing no-desktop copy. Hidden entries stay off unless the user toggles them. Truncation uses the same complete-result bound as browse. There is no git status, no filesystem watch, no in-panel editor, and no create/rename/delete in MVP.

### Host listing

Do not widen `host.listDirectory`. Keep that RPC folder-only for workspace adoption.

Add a Host Consumer over the existing `ctx.fs.listDir` (`FsDirEntry` already carries `file` | `directory` | `other`): a new unary such as `host.listEntries({ path })` answering crumbs, mixed rows (`kind` + name + absolute path + optional size), hidden flag, and truncation. The client never joins path segments. Unreadable or missing targets fail with `directory-unreadable`. The Files tab lists `session.cwd` by default; crumbs may walk below it and, in MVP, also above it (the browse dialog already does). A later tightening can fence listing to the workspace path.

### Packages

- `ui-layout` — no new column; optionally expose `toggleDetails` as the inverse of closed/open at the default width.
- `ui-conversation` — tab shell occupies `details`; Details tab body stays here.
- `ui-files` — Files tab + header action; talks to `ctx.workspaces` / the new list RPC, never imports `ui-workspace` or `ui-directory-picker-browse` components.
- `host/apiproxy` — `host.listEntries` schema, handler, fetch carrier.
- Session store (details or conversation header store) — active tab id + Files current path.

## Alternatives considered

**A fourth AppFrame column.** Rejected: the concession chain, drag handles, and session-lifecycle geometry are specified for one right track. A second right track doubles every clamp and auto-close rule for one extra tab strip.

**File tree in the left sidebar.** Rejected: left is session/workspace navigation ([Workspace Sidebar Order and Folding](../../implemented/feature/2026-08-11-workspace-sidebar-order-and-folding.md)). Mixing files into `WorkspaceBrowser` replaces or crowds that tree.

**Reuse `host.listDirectory` as-is.** Rejected: the browse backend drops files by design. Showing files in the workspace picker would be a product bug; a parallel RPC keeps the two listings honest.

**In-app file preview / editor in the Files tab.** Rejected for MVP: `openPath` already ships for tool-row paths ([tool-call file open](../../implemented/feature/2026-07-28-tool-call-file-open-in-os.md)). An editor is a different product.

**Filesystem watch and git decorations.** Rejected for MVP: `listDir` is a one-shot listing. Watch and status need new Host capabilities and a refresh policy this tab does not have.

**Auto-open the right column on every Session.** Rejected: details start closed; a 360px default would steal the center on every switch. The user opens Files explicitly.

**Put Files in Trajectory's local inspector.** Rejected: that inspector is ledger-row scoped ([trajectory inspection](../../implemented/feature/2026-07-27-trajectory-inspection-ledger.md)). A project file list is Session-scoped chrome.

## Acceptance criteria

- With a non-blank Session, the header Files action opens the right column on the Files tab listing `cwd` (files and directories).
- Directory click navigates; file click opens via `openPath` when the host can; crumbs walk ancestry.
- Tool inspect still opens the same column on the Details tab without losing Files path state for that Session.
- Switching Session closes the column; hero/New Session shows no right track.
- `host.listDirectory` still returns only directories; the workspace picker does not show files.
- Keyless web e2e covers open Files, one directory drill-in, close, and inspect → Details tab. GUI change includes a demonstration GIF when a real-server recording is available.

## Risks

Listing above `cwd` can expose directories outside the workspace; MVP matches browse, and a later fence can restrict it. `openPath` is no-op on remote-only hosts. Reload forgets the open column (existing layout contract). Without a watch, an agent-written file appears only after the next list. Tab chrome plus Chat/Trajectory tabs can confuse if copy collides — Files/Details vs Chat/Trajectory must stay distinct.
