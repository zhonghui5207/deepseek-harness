/**
 * Electron main entry: boot the Web profile in-process, then load its SPA in a
 * sandboxed window. The renderer has no Node or preload privileges; filesystem,
 * shell, sandbox, persistence, and model access remain in the main process.
 * @module @deepseek-ai/dsh-desktop/main
 */

import { app, BrowserWindow, dialog, shell } from 'electron'
import type { Context } from '@deepseek-ai/cordis'
import { bootDesktop, type DesktopRuntime } from './boot.ts'
import { createDesktopShutdown, exitsAfterLastWindow } from './lifecycle.ts'
import { isApplicationNavigation, isExternalWebUrl } from './navigation.ts'

/** Internal packaged-entry probe used by the keyless snapshot and release jobs. */
const SMOKE_FLAG = '--dsh-desktop-smoke'
const smokeMode = process.argv.includes(SMOKE_FLAG)

let root: Context | undefined
let runtimeTask: Promise<DesktopRuntime> | undefined
let applicationUrl: string | undefined
let mainWindow: BrowserWindow | undefined
let quitting = false

/** Session-create response fields consumed by the packaged smoke. */
type SmokeSessionCreateResponse =
  | { result: { ok: true; value: { agentPreset?: string } } }
  | { result: { ok: false; error: { message: string } } }

/** Minimal same-process API face used only by the internal executable probe. */
interface SmokeApiProxy {
  sessions: {
    create(request: {
      rpcId: string
      payload: { sessionId: string; cwd: string; agentPreset: string }
    }): Promise<SmokeSessionCreateResponse>
  }
}

/** Resolve the Host API only when the executable probe needs it. */
function smokeApiProxy(ctx: Context): SmokeApiProxy {
  const apiProxy = (ctx as Context & { apiProxy?: SmokeApiProxy }).apiProxy
  if (apiProxy === undefined) throw new Error('dsh desktop smoke: web profile activated without apiProxy')
  return apiProxy
}

/** Render one startup or renderer-load failure without discarding nested Loader entry errors. */
function formatFailure(error: unknown): string {
  const lines = [error instanceof Error ? error.stack ?? error.message : String(error)]
  let cursor: unknown = error
  for (let depth = 0; depth < 6; depth++) {
    if (typeof cursor !== 'object' || cursor === null) break
    const record = cursor as { errors?: unknown[]; cause?: unknown }
    const errors = Array.isArray(record.errors) ? record.errors : []
    for (const entryError of errors) {
      const detail = entryError instanceof Error ? entryError.stack ?? entryError.message : String(entryError)
      if (!lines.includes(detail)) lines.push(detail)
    }
    cursor = record.cause
  }
  return lines.join('\n\n')
}

function openExternal(targetUrl: string): void {
  if (!isExternalWebUrl(targetUrl)) return
  void shell.openExternal(targetUrl).catch((error: unknown) => {
    console.error('desktop external navigation failed:', error)
  })
}

/** Create the single renderer window and confine navigation to the booted application origin. */
function createWindow(url: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    title: 'DSH Desktop',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = window
  window.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    openExternal(targetUrl)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (isApplicationNavigation(url, targetUrl)) return
    event.preventDefault()
    openExternal(targetUrl)
  })
  void window.loadURL(url).catch((error: unknown) => {
    const detail = formatFailure(error)
    console.error('desktop renderer failed to load:', detail)
    dialog.showErrorBox('DSH Desktop failed to load', detail)
    requestQuit(1)
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  return window
}

function showMainWindow(): void {
  if (quitting) return
  const window = mainWindow
  if (window !== undefined) {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
    return
  }
  if (applicationUrl !== undefined) createWindow(applicationUrl)
}

const shutdown = createDesktopShutdown(
  async () => {
    let context = root
    if (context === undefined && runtimeTask !== undefined) {
      try {
        context = (await runtimeTask).context
      } catch {
        return
      }
    }
    root = undefined
    await context?.fiber.dispose()
  },
  {
    quit: () => { app.quit() },
    exit: (code) => { app.exit(code) },
    setExitCode: (code) => { process.exitCode = code },
  },
)

function requestQuit(code: number): void {
  quitting = true
  shutdown.requestQuit(code)
}

app.on('before-quit', (event) => {
  quitting = true
  shutdown.beforeQuit(event)
})
app.on('window-all-closed', () => {
  if (exitsAfterLastWindow()) requestQuit(0)
})
app.on('activate', showMainWindow)
app.on('second-instance', showMainWindow)
process.on('SIGTERM', () => {
  quitting = true
  shutdown.interrupt(0)
})
process.on('SIGINT', () => {
  quitting = true
  shutdown.interrupt(130)
})

async function launch(): Promise<void> {
  try {
    runtimeTask = bootDesktop({ requestExit: requestQuit })
    const runtime = await runtimeTask
    root = runtime.context
    applicationUrl = runtime.url
    if (quitting) return
    if (smokeMode) {
      const createdPresets: string[] = []
      const apiProxy = smokeApiProxy(runtime.context)
      for (const agentPreset of runtime.agentPresetIds) {
        const created = await apiProxy.sessions.create({
          rpcId: `desktop-smoke-create-${agentPreset}`,
          payload: {
            sessionId: `desktop-smoke-${agentPreset}`,
            cwd: process.cwd(),
            agentPreset,
          },
        })
        if (!created.result.ok) {
          throw new Error(`dsh desktop smoke: session.create(${agentPreset}) failed: ${created.result.error.message}`)
        }
        if (created.result.value.agentPreset !== agentPreset) {
          throw new Error(`dsh desktop smoke: session.create(${agentPreset}) selected ${String(created.result.value.agentPreset)}`)
        }
        createdPresets.push(agentPreset)
      }
      const response = await fetch(runtime.url)
      const html = await response.text()
      process.stdout.write(`dsh desktop smoke: ${JSON.stringify({
        status: response.status,
        contentType: response.headers.get('content-type'),
        hasBootManifest: html.includes('__DSH_BOOT__'),
        loopback: new URL(runtime.url).hostname === '127.0.0.1',
        agentPresetIds: runtime.agentPresetIds,
        createdPresets,
      })}\n`)
      requestQuit(response.ok && html.includes('__DSH_BOOT__') ? 0 : 1)
      return
    }
    createWindow(runtime.url)
  } catch (error) {
    const detail = formatFailure(error)
    console.error('desktop boot failed:', detail)
    if (!smokeMode) dialog.showErrorBox('DSH Desktop failed to start', detail)
    requestQuit(1)
  }
}

if (!app.requestSingleInstanceLock()) {
  app.exit(0)
} else {
  void app.whenReady().then(launch)
}
