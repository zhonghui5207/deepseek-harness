# Agent Note: Session pin to top

Status: implemented

English | [中文](2026-08-15-session-pin-to-top.zh.md)

## Problem

Users need a WeChat-style sticky pin for each chat session in the sidebar: a pinned session stays at the top of its group (and of the flat list) until the user unpins it. Recency, Last updated promotion, and Host manual session order must not scramble that placement. This is not activity pinning (the deleted `touchSession` chain) and not archive: the session stays visible.

Ungrouped sessions have no workspace entity, so a per-workspace field cannot carry the pin. Last updated already promotes a session once inside a browser-local account; a second, Host-durable authority has to sit above that view order without rewriting `WorkspaceView.sessionIds`.

## Decision

**The pin order is a new field on the workspace domain's global singleton (`workspaceDomainState.pinnedSessionIds`), newest pin first, layered over workspace accounting; display partitioning converges in the client's `tree.ts` derivation after existing view order; the wire surface uses the full-snapshot posture already used by archive.**

- Storage: `pinnedSessionIds: z.array(sessionId).default([])`, domain version stays 2 — a purely additive field; pre-field media parse to an empty list through the schema default. Pinning never touches `sessionIds`, so it does not participate in the one-owner accounting invariant. Archiving a pinned session drops it from this order in the same write.
- Registry: `ctx.workspaceRegistry.pinSession(id)` / `unpinSession(id)` ride `enqueueOperation`. Pinning a session neither live nor persisted throws `WorkspaceUnknownSessionError` with action `'pin'`; an already pinned id neither writes nor emits. Unpinning an unpinned id is a no-op and does not require the session to still exist. The `pinnedSessionIds` getter exposes the read-only order.
- RPC: `workspace.pinSession({sessionId})` / `workspace.unpinSession({sessionId})` answer `{pinnedSessionIds}` (the full updated order); `workspace.list` carries the order as the reconnect baseline; `host/pinned-sessions-changed` pushes the full snapshot after every durable change (same posture as `host/archived-sessions-changed`, emitted from the `domain/changed` global-put branch by order comparison). Unknown pin targets reuse `session-not-found`.
- Client runtime: `WorkspaceListState.pinnedSessionIds` (a `readonly SessionId[]`, newest pin first, reference replaced only on membership or position change). The list baseline, the unary echo, and the changed frame each install the complete order. A frame or echo landing during an in-flight `workspace.list` shields the newer order from the stale baseline.
- UI: the session row menu adds Pin session / Unpin session (Chinese copy `置顶会话` / `取消置顶`); a small pin glyph marks pinned rows. `deriveGroups` / `deriveFlat` / the flat-list account reconcile partition pinned ids first in global pin order, then the remaining rows in existing view order, so Last updated promotion cannot lift an unpinned row above them. Pinned rows are not draggable; unpinned drag stays as today. Search ranking is unchanged.

This is user sticky pin. [Session List Browsing and Manual Workspace Order](2026-07-25-session-list-browsing-and-manual-order.md) deleted activity pinning of the Host account. [Workspace Sidebar Order and Folding](2026-08-11-workspace-sidebar-order-and-folding.md) owns Last updated promotion of the browser-local account. Archive remains the hide path ([Session archive](2026-07-31-session-archive-global-set.md)).

## Alternatives considered

**Promote by Last updated / recency instead of a sticky pin.** Rejected: the user asked for a pin that stays until unpin, not a one-shot recency lift that the next prompt can scramble.

**A per-workspace `pinnedSessionIds` field.** Rejected: Ungrouped sessions have no home, the same reason archive is registry-global.

**A dedicated "Pinned" section header above every group.** Rejected for MVP: partition inside each existing group / flat list matches WeChat's per-list sticky rows without a new navigation landmark.

**Drag among pinned rows, or a pin-reorder RPC.** Rejected for MVP: newest-pin-prepends is enough; pinned rows are not draggable so drop targets cannot land inside the pin partition.

**An `archived`/`pinned` flag on `SessionSummary`.** Rejected: it joins a workspace-domain fact into the sessions-domain projection; summaries have no incremental frame, so a separate notification would still be needed.

**Incremental frames (single pinned/unpinned rows).** Rejected: the list is tiny and changes rarely; full snapshots spare client merge logic and match archive and workspace-changed.

## Consequences

Pin order is Host-durable and shared across tabs and reloads. There is no pin-reorder UI yet; changing relative pin order means unpin then pin again (newest prepends). Pinned rows cannot be dragged; unpinned drag writes the same Host or browser-local account as before, and display re-partitions after that account order. Search results do not pin-partition. `workspace.list` gained `pinnedSessionIds` as a pre-release direct edit.

## Testing

Domain tests cover prepend, already-pinned no-op, unpin, archive-strips-pin, unknown-id rejection, restart recovery, and the pre-field media default. Host tests cover the RPCs, `session-not-found` on pin, list baseline, and the changed frame. Runtime tests cover unary echo, frame install, and the in-flight baseline shield. UI tests cover menu Pin/Unpin, glyph, grouped and flat partition, and Last updated not lifting an unpinned row. The workspace-management e2e pins the assembled chain (pin → durable order → still pinned after reload → unpin).
