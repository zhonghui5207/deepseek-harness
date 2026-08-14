# Agent Note: Electron Desktop stays in the monorepo and reuses the Web profile over ephemeral loopback

Status: implemented

English | [中文](2026-08-14-electron-desktop-shell-and-distribution.zh.md)

## Problem

The initial Electron entry could open the Web UI, but it was not a distributable application: it used a fixed port, had no single-instance or bounded shutdown semantics, surfaced startup failures only through a terminal, and had no installer or release workflow. Packaging also exposes failures that loading the Web shell alone cannot detect. Electron Builder does not recover the required workspace peer closure from the monorepo's ambient links, and the system agent presets are application assets rather than Web bundle patches. An executable can therefore serve the SPA while lacking either plugin packages or every preset composition needed to create and resume sessions.

The repository-placement decision is part of the product design. Desktop currently consumes internal profile bundles, client plugin bundles, Loader behavior, and the same release version as the core. Publishing it from a separate repository now would require a second dependency manifest and coordinated compatibility changes without a versioned integration boundary.

## Decision

**Desktop remains an application under `apps/desktop`.** It is released from the same commit as the Harness packages. GitHub installers and archives are the end-user distribution surface; the npm package is an input to packaging. A `desktop-v*` tag creates a prerelease, while a manual Desktop Release run produces workflow artifacts for testing. A repository split is deferred until Desktop consumes a stable, versioned public runtime or carrier API and can release independently.

**The Electron main process boots the shipped `web` profile in-process.** It does not spawn the CLI. A launch-owned overlay binds `dsh-host-webserver` to `127.0.0.1` and port `0`, then the window loads the service's actual assigned URL. This reuses the tested HTTP/WebSocket protocol, frontend dist, settings, credentials, sessions, and plugin roster without a fixed-port collision. An IPC carrier remains a possible future transport change, not a prerequisite for a usable Desktop application.

**The renderer is an unprivileged Web client.** It runs with Chromium sandboxing and context isolation, with Node integration disabled and no preload bridge. Same-origin application navigation stays in the window; HTTP(S) links open in the operating-system browser; `file:`, `javascript:`, and other schemes are not delegated. Filesystem, shell, sandbox, and model operations remain behind the existing host routes in the main process.

**Electron lifecycle adapts the shared bounded shutdown controller.** One instance owns the Harness tree. A second launch focuses that instance. Quit, last-window closure on Windows/Linux, config-tree exit, and signals all converge on awaited Cordis disposal with a five-second bound; repeated interruption or a stuck disposer escalates to immediate exit. macOS keeps the process and tree alive after the last window closes and recreates the window on activation. Native error dialogs expose boot and renderer-load failures when no terminal is visible.

**The executable manifest owns its full workspace peer closure and installed application assets.** Desktop depends on `@deepseek-ai/dsh` as the single installed owner of `config/agent-presets`; its launcher overlays that directory as the system root and validates `code`, `cordis`, `minimal`, and `standard` before opening a window. `verify-runtime-closure` checks the Desktop manifest as well as the Python runtime carrier. The release workflow then starts the actual unpacked executable against a fresh Harness home and creates a session from every system preset, catching missing assets and packages that a shell-only smoke cannot. On Linux, the workflow restores root ownership and mode `4755` on Electron's unpacked `chrome-sandbox` helper before that smoke, matching the installed helper instead of disabling Chromium sandboxing. `asar` is disabled because profile fallback symlinks and Loader resolution require real package directories; this choice is explicit until those mechanisms gain an archive-safe installation representation.

## Consequences

- A user can install the same Web model-routing UI on macOS, Windows, or Linux without running a browser or manually managing a local server.
- New and resumed sessions use the same installed system preset compositions as `dsh web`; an incomplete preset installation fails during Desktop startup instead of after an interaction.
- Desktop and `dsh web` share `$DSH_HOME`, so model routes and credentials configured in either surface are immediately available to the other after restart.
- The renderer still talks to a process-local loopback server. This adds no LAN exposure, but it is not an IPC security boundary and leaves transport consolidation for later.
- Preview releases include the black-whale application icon but remain unsigned and unnotarized, have no updater, and build one native architecture per release runner.
- Desktop loads user patch layers at startup but does not yet call `watchUserPatches`; changing those files requires restart.
- Keeping the application in the monorepo avoids premature API stabilization. It also means Desktop releases follow core commits until a future split deliberately changes that ownership.

## Alternatives considered

- **Create a standalone repository now** — rejected because every current integration dependency is internal and version-coupled; the split would add synchronization work rather than isolate a stable API.
- **Use `file://` plus an Electron IPC carrier before shipping** — deferred because it would require another implementation of the full request/downlink transport and static-module loading path. Ephemeral loopback already exercises the production Web composition and keeps the renderer sandboxed.
- **Spawn `dsh web` as a child process** — rejected because it duplicates process ownership, signal handling, configuration diagnostics, and lifecycle coordination while making error reporting less direct.
- **Keep a dedicated fixed port** — rejected because simultaneous CLI/Desktop launches and stale processes can collide; the operating system already owns safe ephemeral allocation.
- **Distribute only through npm** — rejected because an Electron application's user contract is an installer or platform archive, not a Node package-manager workflow.
- **Copy a second preset tree into Desktop** — rejected because two application-owned copies can drift. The installed `@deepseek-ai/dsh` package remains the source used by both launchers.
- **Enable `asar` immediately** — deferred because user-home profile fallback links must target filesystem directories and dynamically imported plugins include native modules; an archive-safe layout needs its own design and packaged tests.

## Model Experience

No new model-visible content. Desktop mounts the same `dsh-web-app` prompt sections and provider composition as `dsh web`; this decision changes application hosting and distribution only.

#### KV Cache effect

None beyond the existing Web profile, because the Desktop shell adds no request content.
