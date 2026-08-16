# @deepseek-ai/dsh-client-ui-files

English | [中文](README.zh.md)

Session-header Files action and the Files tab of the right inspector. The header folder control calls `ctx.conversation.openInspector('files')` and `ctx.layout.openDetails()`. The tab lists one directory level through `ctx.workspaces.listEntries` (`host.listEntries`): crumbs, mixed file and directory rows, a hidden-entry toggle, and truncation. The default path is the current Session `cwd`; directory clicks and crumbs write the per-session `dsh.files.browse` store. A file row calls `ctx.workspaces.openPath` only when the browser is loopback and `host.describe.canOpenPath` is true; otherwise the row is disabled and uses the existing no-desktop copy.

This package does not import workspace-picker or browse-dialog components. `host.listDirectory` stays folders-only. There is no git status, filesystem watch, in-panel editor, or create/rename/delete. Closing the column keeps the last path and the inspector tab id in their Session stores. The behavior is specified by the [tabbed right inspector Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-right-sidebar-tabbed-inspector.md).

## Model Experience

None, as this package lists host filesystem paths for a human and never reaches a prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Listing is a one-shot read** — an agent-written file appears only after the next list. There is no watch and no git decoration.
- **Crumbs may walk above `cwd`** — MVP matches the browse dialog. A later fence can restrict listing to the workspace path.
- **`openPath` is inert on remote-only hosts** — the row stays visible and disabled with the no-desktop copy.
