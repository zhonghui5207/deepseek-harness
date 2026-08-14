/** Electron quit adaptation over the shared bounded process-shutdown controller. */

import { createProcessShutdown, type ProcessShutdown } from '@deepseek-ai/dsh-app-boot'

/** Minimal Electron quit event accepted by the lifecycle adapter. */
interface QuitEvent {
  preventDefault(): void
}

/** Electron operations whose effects are injected for deterministic tests. */
export interface DesktopExitHost {
  /** Begin Electron's ordinary quit event sequence. */
  quit(): void
  /** Exit immediately after graceful shutdown fails or reaches its bound. */
  exit(code: number): void
  /** Preserve the requested status for the ordinary quit path. */
  setExitCode(code: number): void
}

/** Desktop-owned shutdown entry points used by Electron and config-tree exits. */
export interface DesktopShutdown {
  /** Intercept Electron quit until the application tree reaches quiescence. */
  beforeQuit(event: QuitEvent): void
  /** Request ordinary application exit with a process status. */
  requestQuit(code: number): void
  /** Dispose then exit for a process interrupt; a second interrupt escalates immediately. */
  interrupt(code: number): void
}

/**
 * Whether closing the last window requests application exit on a platform.
 * @param platform - Node platform identifier.
 * @returns false on macOS, whose application remains active without windows.
 */
export function exitsAfterLastWindow(platform: NodeJS.Platform = process.platform): boolean {
  return platform !== 'darwin'
}

/**
 * Adapt bounded process shutdown to Electron's synchronous `before-quit` event.
 * @param dispose - Whole Desktop tree teardown.
 * @param host - Electron quit and exit operations.
 * @param timeoutMs - Optional shutdown bound for tests.
 * @returns synchronous event handlers that never return a Promise to Electron.
 */
export function createDesktopShutdown(
  dispose: () => Promise<void>,
  host: DesktopExitHost,
  timeoutMs?: number,
): DesktopShutdown {
  let requestedCode = 0
  let allowQuit = false
  const shutdown: ProcessShutdown = createProcessShutdown(
    dispose,
    (code) => { host.exit(code) },
    (code) => {
      allowQuit = true
      host.setExitCode(code)
      host.quit()
    },
    timeoutMs,
  )

  return {
    beforeQuit(event) {
      if (allowQuit) return
      event.preventDefault()
      void shutdown.shutdown(requestedCode)
    },
    requestQuit(code) {
      requestedCode = code
      host.quit()
    },
    interrupt(code) {
      shutdown.interrupt(code)
    },
  }
}
