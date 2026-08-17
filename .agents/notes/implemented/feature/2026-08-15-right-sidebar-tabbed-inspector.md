# Agent Note: Right sidebar as a tabbed inspector (Files first)

Status: implemented

English | [中文](2026-08-15-right-sidebar-tabbed-inspector.zh.md)

## Problem

The Web client already has three columns: left session navigation, center conversation, and a right `details` track that only inspects one selected tool call. Users working a project from chat need a persistent file list next to the conversation — not another modal directory picker, and not a second tree fighting the left session list.

`host.listDirectory` cannot feed that list. The browse backend skips non-directories so the workspace picker only shows folders a user can enter. Trajectory inspection already rejected reusing the global details column, so a right-hand file list must not collapse into tool-row clicks.

## Decision

**The existing right grid track is a tabbed inspector. Plugins register tabs. The shipped tabs are Files plus the current tool Details. There is no fourth AppFrame column, and no file tree in the left sidebar.**

### Layout

`AppFrame` stays three columns. `ctx.layout.openDetails` / `closeDetails` and the concession chain (details yields first; closed details render 0px and stay mounted) stay the geometry owner. Session-switch still closes the right track per [Web details follow the current Session lifecycle](../../implemented/bug-fix/2026-07-29-web-details-session-lifecycle.md). The right column remains `scope: 'session'`: a blank New Session / hero has no file list.

A session-header action (folder glyph in `conversation.session.header.actions`) opens the column and selects the Files tab. `ChatViewInjected.openDetails` selects the Details tab and opens the same column. Closing the column forgets neither tab identity nor the last Files path inside that Session store; a later open restores them until the Session changes or the page reloads. Layout widths stay transient (no `localStorage`).

### Tabs

The `details` occupant is a thin tab shell (`InspectorPanel`). Child contributions use the `details.tab` list slot (parallel to `conversation.view`): each plugin supplies `id`, `label`, `order`, and a body. Two shipped tabs:

- **Files** (`id: 'files'`, order 0) — [`ui-files`](../../../../packages/client/ui-files/README.md).
- **Details** (`id: 'details'`, order 10) — `DetailsPanel` (selected call args + `conversation.details.tool`). Empty copy stays “select a tool call”; opening Files does not require a selection.

Later tabs register the same way. Center Chat / Trajectory tabs stay on the conversation header; the two tab rings do not share ids or copy.

The active tab id lives in the conversation chat store (`detailsTab`, persist key `dsh.conversation.chat`). `createChatStore().create()` backfills a missing `detailsTab` to `null` after rehydrate so snapshots from before this field stay typed. `ConversationController.openInspector(tab)` writes that id through the slot-cached store instance `bindInspector` stashes; a tab written before bind is flushed when the details inject runs. `defineStore.create()` does not dedupe, so `ui-files` must not import or recreate the chat store.

### Files tab

Root is the current Session `cwd` (the same root tools resolve against). The list is one directory level plus crumbs, matching the browse dialog's navigation, not a recursive tree.

Rows include files and directories. Clicking a directory lists that level; clicking a file calls `ctx.workspaces.openPath` when the browser is loopback and the host reports `canOpenPath`, otherwise the row is inert with the existing no-desktop copy. Hidden entries (`name.startsWith('.')`) stay off unless the user toggles them. Truncation uses the Config field `listEntriesMaxEntries` (default 1000). There is no git status, no filesystem watch, no in-panel editor, and no create/rename/delete.

The Files path and hidden-entry preference live in a package-owned store (`dsh.files.browse`), not the chat store, because handle identity cannot be shared across packages.

### Host listing

`host.listDirectory` stays folder-only for workspace adoption.

`host.listEntries({ path })` is a Host Consumer over `ctx.fs.listDir` (`FsDirEntry` already carries `file` | `directory` | `other`). Path is required and must be fully qualified (POSIX-absolute, or on Windows a drive-qualified or complete UNC form); relative and rooted drive-less Windows forms fail with `directory-unreadable` instead of rebasing under the host process. The reply carries crumbs, mixed rows (`kind` + name + absolute path + optional size), hidden flag, and truncation. The client never joins path segments. Unreadable or missing targets fail with `directory-unreadable`. The method does not require the browse directory-picker capability. Missing `ctx.fs` fails as `internal`. Crumbs may walk below `cwd` and, in this shipment, also above it (the browse dialog already does).

### Packages

- `ui-layout` — no new column.
- `ui-conversation` — tab shell occupies `details`; Details tab body stays here; `IConversation.openInspector` selects a tab without opening the column.
- `ui-files` — Files tab + header action; talks to `ctx.workspaces` / `host.listEntries`, never imports `ui-workspace` or `ui-directory-picker-browse` components.
- `host/apiproxy` — `host.listEntries` schema, handler, fetch carrier, and `listEntriesMaxEntries` Config.
- Conversation chat store — active tab id. Files store — current path and hidden toggle.

## Alternatives considered

**A fourth AppFrame column.** Rejected: the concession chain, drag handles, and session-lifecycle geometry are specified for one right track. A second right track doubles every clamp and auto-close rule for one extra tab strip.

**File tree in the left sidebar.** Rejected: left is session/workspace navigation ([Workspace Sidebar Order and Folding](../../implemented/feature/2026-08-11-workspace-sidebar-order-and-folding.md)). Mixing files into `WorkspaceBrowser` replaces or crowds that tree.

**Reuse `host.listDirectory` as-is.** Rejected: the browse backend drops files by design. Showing files in the workspace picker would be a product bug; a parallel RPC keeps the two listings honest.

**In-app file preview / editor in the Files tab.** Rejected: `openPath` already ships for tool-row paths ([tool-call file open](../../implemented/feature/2026-07-28-tool-call-file-open-in-os.md)). An editor is a different product.

**Filesystem watch and git decorations.** Rejected: `listDir` is a one-shot listing. Watch and status need new Host capabilities and a refresh policy this tab does not have.

**Auto-open the right column on every Session.** Rejected: details start closed; a 360px default would steal the center on every switch. The user opens Files explicitly.

**Put Files in Trajectory's local inspector.** Rejected: that inspector is ledger-row scoped ([trajectory inspection](../../implemented/feature/2026-07-27-trajectory-inspection-ledger.md)). A project file list is Session-scoped chrome.

## Consequences

Listing above `cwd` can expose directories outside the workspace; this shipment matches browse, and a later fence can restrict it. `openPath` is no-op on remote-only hosts. Reload forgets the open column (existing layout contract). Without a watch, an agent-written file appears only after the next list. Tab chrome plus Chat/Trajectory tabs stay distinct by copy: Files/Details vs Chat/Trajectory.

`ChatViewInjected.openDetails` selects Details and opens the column, but no assembled tool row calls that face. The Files header action is the shipped entry; the Details tab is reachable from the inspector tab strip once the column is open.

## Testing

Keyless coverage: `host.listEntries` on the api-proxy (mixed rows, truncation, unreadable, abort) and the client `IWorkspaces` wire; inspector tab shell (select + close); Files panel (cwd list, hidden toggle, directory drill, inert file, unreadable); conversation `openInspector` bind/pending; web e2e opens Files on a seeded Session, drills one directory, closes, and switches to Details. `host.listDirectory` remains folders-only in the browse fixture.
