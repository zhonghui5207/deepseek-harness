# Agent Note: Desktop release update discovery

Status: implemented

English | [中文](2026-08-14-desktop-release-update-discovery.zh.md)

## Problem

The [Desktop distribution](../architecture/2026-08-14-electron-desktop-shell-and-distribution.md) produces installable artifacts, but an installed application had no way to distinguish its version from the repository's current release. Users had to revisit GitHub and compare filenames manually. Unsigned packages cannot safely support unattended replacement yet, but that constraint should not prevent reliable release discovery or an explicit path to the correct downloads.

## Decision

**The Electron main process owns release discovery.** After the normal application window starts, and whenever the user selects **Help → Check for Updates…**, it requests the fixed unauthenticated GitHub Latest Release endpoint for this repository. The renderer receives no bridge, API, token, or additional navigation privilege.

**Only a valid Desktop release participates in comparison.** The response must carry a `desktop-v<version>` tag whose suffix is valid SemVer. The standard `semver` package compares it with `app.getVersion()`, including stable-versus-prerelease precedence. The request has an eight-second bound. Invalid local versions, non-success HTTP responses, malformed JSON, invalid tags, timeouts, and network failures become a non-fatal unavailable result.

**Automatic and manual checks have different presentation rules.** Startup shows a native dialog only when a newer release exists. A manual check additionally reports current and unavailable outcomes. The native menu retains Electron's standard application, file, edit, view, and window roles and localizes the update actions and dialogs for Chinese application locales.

**Discovery does not install software.** Choosing **Download Update** or **View Releases** opens the fixed HTTPS release page through the operating-system browser. Desktop does not accept a download URL from the API response, download an executable, elevate privileges, or replace its files. Unattended installation remains deferred until every supported package is signed and macOS artifacts are notarized.

## Alternatives considered

**Adopt `electron-updater` immediately.** Rejected because downloading or replacing unsigned binaries would create a misleading one-click experience around Gatekeeper, SmartScreen, integrity, and publisher-identity warnings. Release discovery provides value without claiming that installation is trusted or unattended.

**Put the checker in the Web renderer.** Rejected because update discovery belongs to the installed shell, not the shared Web application. A renderer implementation would add cross-origin network behavior and a main-process bridge solely to open a native download flow.

**Open GitHub automatically on every launch.** Rejected because current versions and transient network failures should not interrupt startup. The browser opens only after an explicit menu action or acceptance of a newer-version prompt.

## Consequences

An installed Desktop application can identify a newer visible release without credentials and guide the user to the repository's supported installers. A GitHub outage or malformed response affects only update status, never application boot. GitHub receives one bounded public API request per normal launch plus any manual checks. Installation remains an explicit operating-system action until signing and notarization justify a separate automatic-update design.

## Model Experience

The update checker runs entirely in the Electron shell. It adds no model request content, tools, provider behavior, session events, or transcript output.

#### KV Cache effect

None. Update discovery does not enter model context.
