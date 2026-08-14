# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

The installable Electron shell for the DeepSeek Harness Web surface. The Electron main process boots the same `web` profile as `dsh web` in-process, overlays `webserver` to `127.0.0.1` with an OS-assigned port, and loads the resulting URL in one sandboxed window. The renderer has `sandbox: true`, context isolation, no Node integration, and no preload bridge; filesystem, shell, session, settings, credential, and model-provider work stays in the main process. Navigation remains on the application origin, while ordinary HTTP(S) links open in the operating-system browser and non-Web schemes are rejected.

Desktop uses the same Harness home as the CLI: `$DSH_HOME`, otherwise `~/.dsh`. Profiles, `settings.yaml`, `.credentials.yaml`, sessions, and model routes therefore carry across without a Desktop-specific migration. Closing the last window exits on Windows and Linux; macOS keeps the application active and recreates the window on activation. A single-instance lock focuses the existing window, and every quit path gives the Cordis tree a bounded graceful shutdown before Electron exits.

## Development and packaging

Build the repository before launching from a clean checkout because the Web profile serves the built frontend dist:

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

Create an unpacked app for local inspection, or the current platform's installer/archive targets:

```sh
pnpm --filter @deepseek-ai/dsh-desktop run dist:dir
pnpm --filter @deepseek-ai/dsh-desktop run smoke:packaged
pnpm --filter @deepseek-ai/dsh-desktop run dist
```

The package manifest deliberately lists the complete required workspace-peer closure for the Web profile and depends on `@deepseek-ai/dsh` as the installed owner of `config/agent-presets`. At startup, Desktop mounts that directory as the system preset root and rejects an installation missing `code`, `cordis`, `minimal`, or `standard`. Electron Builder does not materialize workspace peers from the monorepo's ambient links, so `pnpm run verify-runtime-closure` checks the executable closure. The packaged smoke starts the actual unpacked executable against a new temporary Harness home and creates one session from every system preset, covering the same path as the New Session action and cold session resume. Before the Linux smoke, the release workflow gives Electron's unpacked `chrome-sandbox` helper its installed root ownership and `4755` mode; it does not disable Chromium sandboxing.

`asar` remains disabled because profile fallback links and Cordis Loader imports need real package directories in the installed application. Installers are therefore the supported user artifact; the npm package is a release input, not the end-user installation flow.

## Distribution and repository ownership

[`Desktop Release`](../../.github/workflows/desktop-release.yml) builds native macOS, Windows, and Linux previews, smoke-tests each unpacked application, and uploads the installers and archives. A `desktop-v*` tag additionally publishes those files as a prerelease in the repository's GitHub Releases; a manual workflow run only produces downloadable workflow artifacts.

Desktop stays in this monorepo for now. Its profile bundles, client modules, Loader behavior, and release version all change with the Harness core, so a separate repository would duplicate the dependency manifest and coordinate every compatible core change across repositories without creating a stable boundary. Split it only after Desktop can consume a versioned public runtime/carrier API and has a genuinely independent release cadence.

## Model Experience

Desktop mounts the same `dsh-web-app` bundle and model-visible Web-surface context as `dsh web`; it adds no Desktop-only prompt text or provider behavior. Model selection and routing continue to come from the shared settings and profile layers.

#### KV Cache effect

No additional effect beyond `dsh-web-app`; the Desktop shell contributes no model request content.

## Known Limitations and Deferred Work

- **Preview artifacts are unsigned and unnotarized** — macOS Gatekeeper and Windows SmartScreen can warn. The platform packages include the black-whale application icon.
- **No automatic updates** — install a newer GitHub Release manually.
- **Desktop does not watch user patch files** — changes to home-level or profile `cordis.patch.yml` require an application restart; client-bundle HMR can still operate when its separate rebuild watcher is running.
- **The renderer currently uses loopback HTTP/WebSocket** — it does not use a `file://` renderer or Electron IPC carrier. The server is bound to `127.0.0.1` on an ephemeral port and is not exposed to the LAN.
- **`asar` is disabled** — the unpacked dependency tree is larger, but preserves filesystem-addressable plugin packages and native modules.
- **Each release runner builds its native architecture** — universal and additional architecture targets need an expanded release matrix.
