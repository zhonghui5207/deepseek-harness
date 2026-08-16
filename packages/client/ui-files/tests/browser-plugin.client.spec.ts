/**
 * ui-files plugin halves: the browser entry's dictionary, header-slot, and
 * details-tab registrations against the real SlotRegistry (with fiber
 * teardown proving removal — HMR safety), the inert node entry, and the
 * invariant companion's ownership reservation.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import * as FilesInvariant from '../src/invariant.ts'
import { en, NS, zh } from '../src/client/locales.ts'

/** Slot ledger reader: entry ids currently registered in a list. */
function entryIds(ctx: Context, key: 'conversation.session.header.actions' | 'details.tab'): (string | undefined)[] {
  return ctx.slots.entries(key).map(entry => entry.options.id)
}

/** Boot the browser half over a real slot tree that declares the two lists. */
async function bench(): Promise<{
  ctx: Context
  fiber: ReturnType<Context['plugin']>
  openInspector: ReturnType<typeof vi.fn>
  openDetails: ReturnType<typeof vi.fn>
  listEntries: ReturnType<typeof vi.fn>
  openPath: ReturnType<typeof vi.fn>
}> {
  const ctx = new Context()
  const openInspector = vi.fn()
  const openDetails = vi.fn()
  const listEntries = vi.fn(async () => ({ path: '/p', home: '/h', crumbs: [], entries: [], truncated: false }))
  const openPath = vi.fn(async () => {})
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.session.header.actions': { kind: 'list', scope: 'session' },
      'details.tab': { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
  ctx.provide('sessions', { scope: () => ({ get: () => ({ openInspector }) }) })
  ctx.provide('layout', { openDetails, closeDetails: vi.fn() })
  ctx.provide('workspaces', { listEntries, openPath })
  ctx.provide('connection', {
    api: { settings: {} },
    isLoopback: true,
    hostDescription: { getSnapshot: () => ({ canOpenPath: true }), subscribe: () => () => {} },
  } as never)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, openInspector, openDetails, listEntries, openPath }
}

describe('ui-files browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['sessions', 'slots', 'locale', 'layout', 'workspaces', 'connection'])
  })

  it('registers the header action and Files tab, and fiber teardown removes them', async () => {
    const { ctx, fiber } = await bench()
    expect(entryIds(ctx, 'conversation.session.header.actions')).toContain('files')
    expect(entryIds(ctx, 'details.tab')).toContain('files')
    await fiber.dispose()
    expect(entryIds(ctx, 'conversation.session.header.actions')).not.toContain('files')
    expect(entryIds(ctx, 'details.tab')).not.toContain('files')
  })

  it('registers both dictionaries under its own namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    const translate = ctx.locale.bind(NS)
    expect(translate('tab.files')).toBe(zh['tab.files'])
    ctx.locale.setLocale('en')
    expect(translate('tab.files')).toBe(en['tab.files'])
    await fiber.dispose()
    expect(translate('tab.files')).not.toBe(en['tab.files'])
  })

  it('keeps the English dictionary key-identical to the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('wires the header action and Files tab inject faces to conversation, layout, and workspaces', async () => {
    const { ctx, openInspector, openDetails, listEntries, openPath } = await bench()
    const header = ctx.slots.entries('conversation.session.header.actions')
      .find(entry => entry.options.id === 'files')!
    const opened = (header.inject as (sessionId: SessionId) => { openFiles: () => void })('s1' as SessionId)
    opened.openFiles()
    expect(openInspector).toHaveBeenCalledWith('files')
    expect(openDetails).toHaveBeenCalledTimes(1)

    const tab = ctx.slots.entries('details.tab').find(entry => entry.options.id === 'files')!
    expect((tab.options.label as () => string)()).toBe(zh['tab.files'])
    const face = (tab.inject as () => {
      isLoopback: boolean
      listEntries: (path: string, signal?: AbortSignal) => Promise<unknown>
      openPath: (path: string) => void
    })()
    expect(face.isLoopback).toBe(true)
    const signal = new AbortController().signal
    await face.listEntries('/p', signal)
    expect(listEntries).toHaveBeenCalledWith('/p', signal)
    face.openPath('/p/README.md')
    await Promise.resolve()
    expect(openPath).toHaveBeenCalledWith('/p/README.md')
    openPath.mockRejectedValueOnce(new Error('unusable'))
    face.openPath('/missing')
    await Promise.resolve()
    expect(openPath).toHaveBeenCalledWith('/missing')
  })
})

describe('ui-files node half', () => {
  it('contributes no host behavior', () => {
    expect(applyNode).not.toThrow()
  })
})

describe('ui-files invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(FilesInvariant)
    await fiber.await()
    expect(FilesInvariant.name).toBe('client-ui-files-invariant')
    expect(FilesInvariant.inject).toEqual(['invariants'])
    expect(() => { (ctx.emit as (event: string) => void)('slots/changed') }).not.toThrow()
    await fiber.dispose()
  })
})
