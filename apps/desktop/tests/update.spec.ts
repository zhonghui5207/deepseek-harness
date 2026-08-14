import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  checkForDesktopUpdate,
  createDesktopMenuTemplate,
  DESKTOP_RELEASES_URL,
  desktopUpdateCopy,
} from '../src/update.ts'

function releaseResponse(tag: string, status = 200): Response {
  return new Response(JSON.stringify({ tag_name: tag }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Desktop update discovery', () => {
  it('recognizes a stable release as newer than the installed prerelease', async () => {
    const fetchUpdate = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => (
      releaseResponse('desktop-v0.1.0')
    ))

    await expect(checkForDesktopUpdate('0.1.0-rc.5', { fetch: fetchUpdate })).resolves.toEqual({
      kind: 'update-available',
      currentVersion: '0.1.0-rc.5',
      latestVersion: '0.1.0',
      releaseUrl: DESKTOP_RELEASES_URL,
    })

    expect(fetchUpdate).toHaveBeenCalledOnce()
    expect(fetchUpdate.mock.calls[0]?.[0]).toBe(
      'https://api.github.com/repos/zhonghui5207/deepseek-harness-desktop/releases/latest',
    )
    expect(fetchUpdate.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DSH-Desktop/0.1.0-rc.5',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  })

  it('does not offer an older prerelease over an installed stable version', async () => {
    const fetchUpdate = vi.fn(async () => releaseResponse('desktop-v0.1.0-rc.9'))
    await expect(checkForDesktopUpdate('0.1.0', { fetch: fetchUpdate })).resolves.toEqual({
      kind: 'up-to-date',
      currentVersion: '0.1.0',
      latestVersion: '0.1.0-rc.9',
    })
  })

  const unavailableCases: ReadonlyArray<readonly [string, typeof fetch, string]> = [
    ['an HTTP failure', async () => releaseResponse('desktop-v0.1.0', 503), 'HTTP 503'],
    ['a malformed tag', async () => releaseResponse('v0.1.0'), 'desktop-v<version>'],
    ['an invalid Desktop version', async () => releaseResponse('desktop-vnext'), 'invalid Desktop version'],
    ['a non-object response', async () => new Response('null', { status: 200 }), 'must be an object'],
  ]

  it.each(unavailableCases)('turns %s into a non-fatal unavailable result', async (_name, fetchUpdate, reason) => {
    const result = await checkForDesktopUpdate('0.1.0-rc.5', { fetch: fetchUpdate })
    expect(result.kind).toBe('unavailable')
    if (result.kind !== 'unavailable') throw new TypeError('failed update lookup must be unavailable')
    expect(result.reason).toContain(reason)
  })

  it('rejects an invalid installed version before making a request', async () => {
    const fetchUpdate = vi.fn(async () => releaseResponse('desktop-v0.1.0'))
    await expect(checkForDesktopUpdate('development', { fetch: fetchUpdate })).resolves.toEqual({
      kind: 'unavailable',
      reason: 'installed Desktop version is invalid: development',
    })
    expect(fetchUpdate).not.toHaveBeenCalled()
  })

  it('bounds a stalled GitHub request', async () => {
    vi.useFakeTimers()
    const fetchUpdate = vi.fn((_input: string | URL | Request, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (signal === undefined || signal === null) throw new Error('update request must carry an abort signal')
        signal.addEventListener('abort', () => {
          reject(signal.reason instanceof Error ? signal.reason : new Error('update request aborted'))
        }, { once: true })
      })
    ))
    const result = checkForDesktopUpdate('0.1.0-rc.5', { fetch: fetchUpdate, timeoutMs: 25 })

    await vi.advanceTimersByTimeAsync(25)

    await expect(result).resolves.toEqual({
      kind: 'unavailable',
      reason: 'GitHub Releases request timed out',
    })
  })
})

describe('Desktop update presentation', () => {
  it('retains standard role menus and adds explicit update actions', () => {
    const onCheckUpdates = vi.fn()
    const onViewReleases = vi.fn()
    const template = createDesktopMenuTemplate(
      'darwin',
      desktopUpdateCopy('en-US'),
      onCheckUpdates,
      onViewReleases,
    )
    const help = template.at(-1)
    if (!Array.isArray(help?.submenu)) throw new TypeError('Desktop Help menu must be an item array')

    expect(template.slice(0, -1).map(item => item.role)).toEqual([
      'appMenu',
      'fileMenu',
      'editMenu',
      'viewMenu',
      'windowMenu',
    ])
    expect(help.label).toBe('Help')
    expect(help.submenu).toEqual([
      { label: 'Check for Updates…', click: onCheckUpdates },
      { type: 'separator' },
      { label: 'View Releases', click: onViewReleases },
    ])
    expect(createDesktopMenuTemplate(
      'linux',
      desktopUpdateCopy('en-US'),
      onCheckUpdates,
      onViewReleases,
    ).map(item => item.role).filter(role => role !== undefined)).toEqual([
      'fileMenu',
      'editMenu',
      'viewMenu',
      'windowMenu',
    ])
  })

  it('provides complete Chinese native copy', () => {
    const copy = desktopUpdateCopy('zh-CN')
    expect({
      helpMenu: copy.helpMenu,
      checkForUpdates: copy.checkForUpdates,
      viewReleases: copy.viewReleases,
      available: copy.updateAvailableMessage('0.1.0'),
      detail: copy.updateAvailableDetail('0.1.0-rc.5'),
      current: copy.upToDateMessage('0.1.0'),
      failed: copy.checkFailedMessage,
      ok: copy.ok,
    }).toMatchInlineSnapshot(`
      {
        "available": "DSH Desktop 0.1.0 已可用。",
        "checkForUpdates": "检查更新…",
        "current": "DSH Desktop 0.1.0 已是最新发布版本。",
        "detail": "当前版本为 0.1.0-rc.5。打开发布页面即可下载并安装更新。",
        "failed": "DSH Desktop 无法连接 GitHub Releases。请检查网络连接后重试。",
        "helpMenu": "帮助",
        "ok": "确定",
        "viewReleases": "查看发布页面",
      }
    `)
  })
})
