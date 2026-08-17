# Agent Note: Shared launcher profile overlays live in dsh-app-boot

Status: implemented

English | [中文](2026-08-15-shared-launcher-profile-overlays.zh.md)

## Problem

`dsh` and Desktop both boot a named profile over an empty root, then apply the same kinds of launcher overlay: the home-level `$DSH_HOME/cordis.patch.yml`, a rewrite of the `agent-presets` system root, and the `DSH_TELEMETRY_DISABLED` hard opt-out. Those helpers lived in `apps/cli/src/profile-boot.ts`, so Desktop copied `homePatchPath` and the preset-root rewrite, recomposed the full patch stack just to find the roster row, and never applied the telemetry overlay.

The [default-mount decision](../feature/2026-07-31-web-telemetry-default-mount.md) requires the hard opt-out to take effect before Loader construction. Desktop smoke and CI set `DSH_TELEMETRY_DISABLED=1`, but without a launcher patch that environment variable does not disable the row. Default `DISABLED` mode hid the gap until a deployment selected `FULL` or `FEEDBACK_ONLY`.

## Decision

Launcher overlay helpers that every profile boot shares live in [`@deepseek-ai/dsh-app-boot`](../../../../packages/boot/app-boot/README.md):

- `PROFILE_ROOT_FILENAME` and `homePatchPath()` name the empty root and the home-level user patch.
- `indexComposedRows()` maps composed entry ids after applying layers over an empty root.
- `shippedAgentPresetOverlay(rows, root)` rewrites the `agent-presets` system root when that row exists; each launcher supplies its own install path.
- `TELEMETRY_ROW_ID` and `resolveTelemetryPatch()` turn any non-empty `DSH_TELEMETRY_DISABLED` into a disable overlay when the composition carries `session-telemetry-otel`.

`dsh` still owns `--patch` files, live `watchUserPatches`, process signals, and the CLI-adjacent preset directory. Desktop still owns the loopback webserver overlay, the `@deepseek-ai/dsh` preset-root resolution, shipped-preset verification, and Electron lifecycle. Both call the shared helpers in the same layer order: bundles, profile patch, home patch, launcher overlays, then preset-root and telemetry.

ACP demo does not boot a profile and does not apply these overlays.

## Alternatives considered

**Keep the helpers in `apps/cli` and import them from Desktop.** Rejected: Desktop would depend on the CLI application package, mixing a product launcher into another product launcher, and the CLI package is not a library contract.

**Extract a full `composeProfile()` that both launchers call.** Rejected: Desktop has no `--patch` files or HMR recomposition, and it must fail loud when `agent-presets` is missing; folding those differences into one options object hides the ownership split the [Desktop shell decision](2026-08-14-electron-desktop-shell-and-distribution.md) already records.

**Leave Desktop without the telemetry overlay because default mode is `DISABLED`.** Rejected: CI and smoke already set the hard opt-out, and a Desktop user who enables `DSH_TELEMETRY_MODE` must get the same pre-load disable as `dsh`.

## Consequences

- `dsh` and Desktop cannot drift on home-patch path, telemetry hard opt-out, or preset-root overlay construction.
- Desktop now disables `session-telemetry-otel` before Loader mount when `DSH_TELEMETRY_DISABLED` is non-empty, including `'0'` and `'false'`.
- A third profile launcher adds overlays by calling these helpers rather than copying CLI boot.
- ACP demo remains outside this contract because it does not compose a profile.

## Testing

`packages/boot/app-boot/tests/profile.spec.ts` pins `homePatchPath`, `resolveTelemetryPatch`, `indexComposedRows`, and `shippedAgentPresetOverlay`. `apps/desktop/tests/boot.spec.ts` pins Desktop's loopback, preset-root, and telemetry overlay order, including the missing-roster failure.
