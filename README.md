# DSH Desktop

English | [中文](README.zh.md)

<p align="center">
  <img src="apps/desktop/build/icon.png" alt="DSH Desktop black-whale icon" width="168" height="168">
</p>

<p align="center">
  <a href="https://github.com/zhonghui5207/deepseek-harness-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/zhonghui5207/deepseek-harness-desktop?display_name=tag" alt="Latest release"></a>
  <a href="https://github.com/zhonghui5207/deepseek-harness-desktop/actions/workflows/desktop-release.yml"><img src="https://github.com/zhonghui5207/deepseek-harness-desktop/actions/workflows/desktop-release.yml/badge.svg" alt="Desktop Release"></a>
</p>

DSH Desktop packages the DeepSeek Harness Web interface and runtime as an installable Electron application. The Harness runtime, workspaces, sessions, tools, and model routing run locally; model requests follow the provider endpoints configured by the user.

## Download

Download the current installers and archives from [GitHub Releases](https://github.com/zhonghui5207/deepseek-harness-desktop/releases/latest).

| Platform | Recommended file | Architecture |
|---|---|---|
| macOS | `.dmg` | Apple Silicon (`arm64`) |
| Windows | `.exe` | `x64` |
| Linux | `.AppImage` | `x86_64` |

The current packages are unsigned and unnotarized. macOS Gatekeeper and Windows SmartScreen may display a warning; review the release and use the operating system's explicit open action when you trust the downloaded file.

<a id="run"></a>

## Install and configure

1. Download the package for your platform. On macOS, open the DMG and move DSH Desktop to Applications. On Windows, run the installer. On Linux, make the AppImage executable before starting it.
2. Open **Settings → Models** and add the API endpoint and model routes you want to use.
3. Start a new session, choose the configured model, and select a workspace directory.

For an OpenAI-compatible local gateway such as OCX Local Gateway, the values typically look like this:

```text
API URL: http://127.0.0.1:10100/v1
API protocol: openai-responses
Model ID: provider/model-name
```

The protocol must match the endpoint implemented by the gateway, and the model ID must match the ID returned by that gateway. Store credentials through the application settings; never commit them to the repository.

## Local data

Desktop and the `dsh` CLI use the same Harness home: `$DSH_HOME` when set, otherwise `~/.dsh`. Settings, credential references, sessions, model routes, and profiles therefore remain available across both interfaces. Keep this directory private because it contains local application state and may reference credentials.

The renderer is sandboxed and connects only to a loopback server owned by the Desktop process. The application does not expose that server to the LAN.

## Updating

Each published version is built and smoke-tested independently for macOS, Windows, and Linux. Desktop checks the repository's visible Latest Release after startup and prompts only when it finds a newer version. Use **Help → Check for Updates…** to check manually at any time.

**Download Update** opens the release page in the operating-system browser. The application never downloads or replaces itself silently; install the selected package through the normal platform flow. Fully automatic installation remains deferred until the packages are signed and notarized.

<a id="run-from-source"></a>

## Development

The repository is a monorepo because the Desktop application and Harness runtime currently release from the same source commit. See the [Desktop package reference](apps/desktop/README.md) for its architecture, security model, packaging commands, and known limitations.

```sh
git clone https://github.com/zhonghui5207/deepseek-harness-desktop.git
cd deepseek-harness-desktop
pnpm install
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

Contributor setup and architecture are documented in the [development guide](docs/development.md) and [architecture reference](docs/architecture.md).

## License and attribution

DSH Desktop is a community desktop distribution built with the DeepSeek Harness codebase and Cordis. The repository is licensed under [MIT](LICENSE); dependency notices are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
