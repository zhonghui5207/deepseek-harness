import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesktopShutdown, exitsAfterLastWindow } from '../src/lifecycle.ts'

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void
  const promise = new Promise<void>((accept) => { resolve = accept })
  return { promise, resolve }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Desktop lifecycle', () => {
  it('keeps the macOS application alive after its last window closes', () => {
    expect(exitsAfterLastWindow('darwin')).toBe(false)
    expect(exitsAfterLastWindow('linux')).toBe(true)
    expect(exitsAfterLastWindow('win32')).toBe(true)
  })

  it('holds Electron quit until disposal settles, then allows the second quit event', async () => {
    const disposal = deferred()
    const host = {
      quit: vi.fn(),
      exit: vi.fn(),
      setExitCode: vi.fn(),
    }
    const shutdown = createDesktopShutdown(() => disposal.promise, host)
    const firstEvent = { preventDefault: vi.fn() }

    shutdown.requestQuit(7)
    expect(host.quit).toHaveBeenCalledOnce()
    shutdown.beforeQuit(firstEvent)
    expect(firstEvent.preventDefault).toHaveBeenCalledOnce()
    expect(host.setExitCode).not.toHaveBeenCalled()

    disposal.resolve()
    await vi.waitFor(() => { expect(host.quit).toHaveBeenCalledTimes(2) })
    expect(host.setExitCode).toHaveBeenCalledWith(7)
    expect(host.exit).not.toHaveBeenCalled()

    const completionEvent = { preventDefault: vi.fn() }
    shutdown.beforeQuit(completionEvent)
    expect(completionEvent.preventDefault).not.toHaveBeenCalled()
  })

  it('forces Electron exit when disposal exceeds its bound', async () => {
    vi.useFakeTimers()
    const disposal = deferred()
    const host = {
      quit: vi.fn(),
      exit: vi.fn(),
      setExitCode: vi.fn(),
    }
    const shutdown = createDesktopShutdown(() => disposal.promise, host, 25)

    shutdown.requestQuit(9)
    shutdown.beforeQuit({ preventDefault: vi.fn() })
    await vi.advanceTimersByTimeAsync(25)

    expect(host.exit).toHaveBeenCalledOnce()
    expect(host.exit).toHaveBeenCalledWith(9)
    expect(host.setExitCode).not.toHaveBeenCalled()
    disposal.resolve()
  })
})
