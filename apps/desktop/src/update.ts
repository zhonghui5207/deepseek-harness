/**
 * GitHub Release discovery, localized native copy, and application-menu
 * construction for DSH Desktop updates.
 * @module @deepseek-ai/dsh-desktop/update
 */

import type { MenuItemConstructorOptions } from 'electron'
import { gt, valid } from 'semver'

/** Public page containing the supported Desktop installers and archives. */
export const DESKTOP_RELEASES_URL = 'https://github.com/zhonghui5207/deepseek-harness-desktop/releases/latest'

const LATEST_RELEASE_API = 'https://api.github.com/repos/zhonghui5207/deepseek-harness-desktop/releases/latest'
const UPDATE_CHECK_TIMEOUT_MS = 8_000
const DESKTOP_TAG_PREFIX = 'desktop-v'

/** Outcome of one non-authenticated GitHub Latest Release lookup. */
export type DesktopUpdateResult =
  | {
    readonly kind: 'update-available'
    readonly currentVersion: string
    readonly latestVersion: string
    readonly releaseUrl: string
  }
  | {
    readonly kind: 'up-to-date'
    readonly currentVersion: string
    readonly latestVersion: string
  }
  | {
    readonly kind: 'unavailable'
    readonly reason: string
  }

/** Injectable request settings used by the main process and focused tests. */
export interface DesktopUpdateCheckOptions {
  /** Fetch implementation; production uses the Electron main process global. */
  readonly fetch?: typeof fetch
  /** Upper bound for the GitHub request in milliseconds. */
  readonly timeoutMs?: number
}

/** Localized native-menu and dialog text for one application locale. */
export interface DesktopUpdateCopy {
  readonly helpMenu: string
  readonly checkForUpdates: string
  readonly viewReleases: string
  readonly updateAvailableTitle: string
  readonly updateAvailableMessage: (latestVersion: string) => string
  readonly updateAvailableDetail: (currentVersion: string) => string
  readonly downloadUpdate: string
  readonly later: string
  readonly upToDateTitle: string
  readonly upToDateMessage: (currentVersion: string) => string
  readonly checkFailedTitle: string
  readonly checkFailedMessage: string
  readonly ok: string
}

/**
 * Select native update copy from Electron's application locale.
 * @param locale - Locale returned by `app.getLocale()`.
 * @returns Chinese copy for `zh*` locales, otherwise English copy.
 */
export function desktopUpdateCopy(locale: string): DesktopUpdateCopy {
  if (locale.toLowerCase().startsWith('zh')) {
    return {
      helpMenu: '帮助',
      checkForUpdates: '检查更新…',
      viewReleases: '查看发布页面',
      updateAvailableTitle: '发现新版本',
      updateAvailableMessage: latestVersion => `DSH Desktop ${latestVersion} 已可用。`,
      updateAvailableDetail: currentVersion => `当前版本为 ${currentVersion}。打开发布页面即可下载并安装更新。`,
      downloadUpdate: '下载更新',
      later: '稍后',
      upToDateTitle: '已是最新版本',
      upToDateMessage: currentVersion => `DSH Desktop ${currentVersion} 已是最新发布版本。`,
      checkFailedTitle: '暂时无法检查更新',
      checkFailedMessage: 'DSH Desktop 无法连接 GitHub Releases。请检查网络连接后重试。',
      ok: '确定',
    }
  }
  return {
    helpMenu: 'Help',
    checkForUpdates: 'Check for Updates…',
    viewReleases: 'View Releases',
    updateAvailableTitle: 'Update available',
    updateAvailableMessage: latestVersion => `DSH Desktop ${latestVersion} is available.`,
    updateAvailableDetail: currentVersion => `You are using ${currentVersion}. Open the release page to download and install the update.`,
    downloadUpdate: 'Download Update',
    later: 'Later',
    upToDateTitle: 'Up to date',
    upToDateMessage: currentVersion => `DSH Desktop ${currentVersion} is the latest published version.`,
    checkFailedTitle: 'Unable to check for updates',
    checkFailedMessage: "DSH Desktop couldn't reach GitHub Releases. Check your connection and try again.",
    ok: 'OK',
  }
}

/**
 * Build the native application menu while retaining Electron's standard role menus.
 * @param platform - Current Node platform.
 * @param copy - Localized labels for the Help menu.
 * @param onCheckUpdates - Manual update-check callback.
 * @param onViewReleases - Release-page callback.
 * @returns Menu template passed to Electron.
 */
export function createDesktopMenuTemplate(
  platform: NodeJS.Platform,
  copy: DesktopUpdateCopy,
  onCheckUpdates: () => void,
  onViewReleases: () => void,
): MenuItemConstructorOptions[] {
  return [
    ...platform === 'darwin' ? [{ role: 'appMenu' as const }] : [],
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: copy.helpMenu,
      submenu: [
        { label: copy.checkForUpdates, click: onCheckUpdates },
        { type: 'separator' },
        { label: copy.viewReleases, click: onViewReleases },
      ],
    },
  ]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function releaseVersion(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new TypeError('GitHub latest release response must be an object')
  }
  const tag = (payload as Record<string, unknown>).tag_name
  if (typeof tag !== 'string' || !tag.startsWith(DESKTOP_TAG_PREFIX)) {
    throw new TypeError(`GitHub latest release must use a ${DESKTOP_TAG_PREFIX}<version> tag`)
  }
  const version = valid(tag.slice(DESKTOP_TAG_PREFIX.length))
  if (version === null) throw new TypeError(`GitHub latest release has an invalid Desktop version: ${tag}`)
  return version
}

/**
 * Compare the installed version with the repository's visible Latest Release.
 * Network, HTTP, and response-validation failures become an unavailable result
 * so update discovery never blocks Desktop startup.
 * @param currentVersion - Version reported by the packaged Electron application.
 * @param options - Optional request dependencies and timeout for tests.
 * @returns Availability, current status, or a non-fatal failure reason.
 */
export async function checkForDesktopUpdate(
  currentVersion: string,
  options: DesktopUpdateCheckOptions = {},
): Promise<DesktopUpdateResult> {
  const current = valid(currentVersion)
  if (current === null) {
    return { kind: 'unavailable', reason: `installed Desktop version is invalid: ${currentVersion}` }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort(new Error('GitHub Releases request timed out'))
  }, options.timeoutMs ?? UPDATE_CHECK_TIMEOUT_MS)

  try {
    const request = options.fetch ?? globalThis.fetch
    const response = await request(LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `DSH-Desktop/${current}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`GitHub Releases returned HTTP ${String(response.status)}`)
    const payload: unknown = await response.json()
    const latest = releaseVersion(payload)
    if (gt(latest, current)) {
      return {
        kind: 'update-available',
        currentVersion: current,
        latestVersion: latest,
        releaseUrl: DESKTOP_RELEASES_URL,
      }
    }
    return { kind: 'up-to-date', currentVersion: current, latestVersion: latest }
  } catch (error) {
    return { kind: 'unavailable', reason: errorMessage(error) }
  } finally {
    clearTimeout(timeout)
  }
}
