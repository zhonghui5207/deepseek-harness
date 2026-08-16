// @vitest-environment jsdom
/** Files tab listing, crumbs, hidden toggle, and file open. */
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { PathListing, SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { FilesPanel } from '../src/client/FilesPanel.tsx'
import { createFilesStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

const SID = 's1' as import('@deepseek-ai/dsh-client-runtime/client').SessionId

const listing: PathListing = {
  path: '/proj',
  home: '/home',
  crumbs: [
    { name: '/', path: '/', hidden: false },
    { name: 'proj', path: '/proj', hidden: false },
  ],
  entries: [
    { name: '.env', path: '/proj/.env', kind: 'file', hidden: true },
    { name: 'README.md', path: '/proj/README.md', kind: 'file', hidden: false },
    { name: 'src', path: '/proj/src', kind: 'directory', hidden: false },
  ],
  truncated: false,
}

function t(key: keyof typeof zh): string {
  return zh[key]
}

function mount(overrides: {
  listing?: PathListing | Promise<PathListing>
  canOpenPath?: boolean
  isLoopback?: boolean
  cwd?: string | undefined
  hasCwd?: boolean
} = {}) {
  const files = createFilesStore().create()
  const openPath = vi.fn()
  const listEntries = vi.fn(async () => await (overrides.listing ?? listing))
  const sessions = createSnapshotStore<SessionListState>({
    ids: [SID],
    byId: { [SID]: { id: SID, title: 'S', displayTitle: 'S', cwd: overrides.hasCwd === false ? undefined : (overrides.cwd ?? '/proj') } as never },
    current: SID,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  })
  const workspaces = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  const description = { version: 't', cwd: '/proj', attachedSessions: 1, canOpenPath: overrides.canOpenPath ?? true }
  const view = render(
    <FilesPanel
      sessionId={SID}
      useSession={() => { throw new Error('unused') }}
      useSessions={bindSnapshotSelector(sessions)}
      useWorkspaces={bindSnapshotSelector(workspaces)}
      useProjection={() => undefined}
      useInput={() => { throw new Error('unused') }}
      inputActions={{
        setDraft: () => {},
        addImages: () => true,
        removeImage: () => {},
        pruneImages: () => {},
        submit: () => {},
      }}
      useStore={bindSnapshotSelector(files)}
      actions={files.actions}
      isLoopback={overrides.isLoopback ?? true}
      listEntries={listEntries}
      openPath={openPath}
      useHostDescription={sel => sel(description)}
      t={t as never}
    />,
  )
  return { view, files, openPath, listEntries }
}

describe('FilesPanel', () => {
  it('lists the session cwd and opens a file when the host can', async () => {
    const user = userEvent.setup()
    const { view, openPath, listEntries } = mount()
    await waitFor(() => { expect(listEntries).toHaveBeenCalledWith('/proj', expect.any(AbortSignal)) })
    expect(view.queryByText('.env')).toBeNull()
    await user.click(view.getByRole('button', { name: zh['hidden.show'] }))
    expect(view.getByText('.env')).toBeTruthy()
    await user.click(view.getByRole('button', { name: 'README.md' }))
    expect(openPath).toHaveBeenCalledWith('/proj/README.md')
  })

  it('navigates into a directory and walks crumbs', async () => {
    const user = userEvent.setup()
    const nested: PathListing = {
      ...listing,
      path: '/proj/src',
      crumbs: [...listing.crumbs, { name: 'src', path: '/proj/src', hidden: false }],
      entries: [{ name: 'index.ts', path: '/proj/src/index.ts', kind: 'file', hidden: false }],
    }
    const { view, files, listEntries } = mount()
    await waitFor(() => { expect(view.getByText('src')).toBeTruthy() })
    listEntries.mockResolvedValueOnce(nested)
    await user.click(view.getByRole('button', { name: 'src' }))
    expect(files.store.getSnapshot().path).toBe('/proj/src')
    await waitFor(() => { expect(listEntries).toHaveBeenLastCalledWith('/proj/src', expect.any(AbortSignal)) })
  })

  it('leaves a file inert when the host cannot open paths', async () => {
    const user = userEvent.setup()
    const { view, openPath } = mount({ canOpenPath: false })
    await waitFor(() => { expect(view.getByText('README.md')).toBeTruthy() })
    expect(view.getByRole('button', { name: 'README.md' })).toBeDisabled()
    await user.click(view.getByRole('button', { name: 'README.md' }))
    expect(openPath).not.toHaveBeenCalled()
  })

  it('shows the Host business message when a listing fails', async () => {
    const { view } = mount({
      listing: Promise.reject(new DirectoryBrowseError({
        code: 'directory-unreadable', message: 'denied', details: {},
      })),
    })
    await waitFor(() => { expect(view.getByText('denied')).toBeTruthy() })
  })

  it('shows the generic list error when the session has no cwd', async () => {
    const { view } = mount({ hasCwd: false })
    await waitFor(() => { expect(view.getByText(zh['list.error'])).toBeTruthy() })
  })

  it('shows an Error message, an unknown failure, an empty directory, and truncation', async () => {
    const { view: errorView } = mount({ listing: Promise.reject(new Error('boom')) })
    await waitFor(() => { expect(errorView.getByText('boom')).toBeTruthy() })
    errorView.unmount()

    const { view: unknownView } = mount({ listing: Promise.reject('nope') })
    await waitFor(() => { expect(unknownView.getByText(zh['list.error'])).toBeTruthy() })
    unknownView.unmount()

    const { view: emptyView } = mount({
      listing: { ...listing, entries: [] },
    })
    await waitFor(() => { expect(emptyView.getByText(zh['list.empty'])).toBeTruthy() })
    emptyView.unmount()

    const { view: truncatedView } = mount({
      listing: { ...listing, truncated: true },
    })
    await waitFor(() => {
      expect(truncatedView.getByText('仅显示前 3 项')).toBeTruthy()
    })
  })

  it('ignores a listing that settles after the effect is superseded', async () => {
    const nested: PathListing = {
      ...listing,
      path: '/other',
      crumbs: [{ name: '/', path: '/', hidden: false }, { name: 'other', path: '/other', hidden: false }],
      entries: [],
    }
    const run = async (settle: (ok: (value: PathListing) => void, fail: (error: unknown) => void) => void) => {
      let ok: (value: PathListing) => void = () => {}
      let fail: (error: unknown) => void = () => {}
      const first = new Promise<PathListing>((resolve, reject) => {
        ok = resolve
        fail = reject
      })
      const { view, files, listEntries } = mount({ listing: first })
      listEntries.mockImplementation(async (path: string) => {
        if (path === '/other') return nested
        return await first
      })
      files.actions.setPath('/other')
      await waitFor(() => { expect(view.getByText(zh['list.empty'])).toBeTruthy() })
      settle(ok, fail)
      expect(view.queryByText('README.md')).toBeNull()
      view.unmount()
    }
    await run((ok) => { ok(listing) })
    await run((_ok, fail) => { fail(new Error('late')) })
  })
})
