// @vitest-environment jsdom
/** Inspector tab shell: tab selection and close. */
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { InspectorPanel } from '../src/client/skeleton/InspectorPanel.tsx'
import { createChatStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

const SID = 's1' as import('@deepseek-ai/dsh-client-runtime/client').SessionId

describe('InspectorPanel', () => {
  it('renders registered tabs, writes the selected id, and closes the column', async () => {
    const user = userEvent.setup()
    const chat = createChatStore().create()
    const closeDetails = vi.fn()
    const rendered: string[] = []
    const sessions = createSnapshotStore<SessionListState>({
      ids: [SID],
      byId: { [SID]: { id: SID, title: 'S', displayTitle: 'S', cwd: '/p' } as never },
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
    const view = render(
      <InspectorPanel
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
        useStore={bindSnapshotSelector(chat)}
        actions={chat.actions}
        closeDetails={closeDetails}
        tabs={{
          list: () => [
            { id: 'files', label: '文件' },
            { id: 'details', label: '详情' },
          ],
          subscribe: () => () => {},
          version: () => 1,
        }}
        renderSlot={(key, _owner, options) => {
          rendered.push(String((options as { only?: string } | undefined)?.only ?? key))
          return <div data-testid="tab-body" />
        }}
        t={(key: string) => (key === 'inspector.tabs' ? zh['inspector.tabs'] : zh['details.close']) as never}
      />,
    )
    expect(view.getByRole('complementary', { name: zh['inspector.tabs'] })).toBeTruthy()
    expect(view.getByRole('tab', { name: '文件' })).toHaveAttribute('aria-selected', 'true')
    expect(rendered.at(-1)).toBe('files')
    await user.click(view.getByRole('tab', { name: '详情' }))
    expect(chat.store.getSnapshot().detailsTab).toBe('details')
    await user.click(view.getByRole('button', { name: zh['details.close'] }))
    expect(closeDetails).toHaveBeenCalledTimes(1)
  })

  it('falls back to the first tab when the stored id is unknown', () => {
    const chat = createChatStore().create()
    chat.actions.setDetailsTab('ghost')
    const sessions = createSnapshotStore<SessionListState>({
      ids: [SID],
      byId: { [SID]: { id: SID, title: 'S', displayTitle: 'S', cwd: '/p' } as never },
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
    const rendered: string[] = []
    render(
      <InspectorPanel
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
        useStore={bindSnapshotSelector(chat)}
        actions={chat.actions}
        closeDetails={() => {}}
        tabs={{
          list: () => [{ id: 'files', label: '文件' }],
          subscribe: () => () => {},
          version: () => 1,
        }}
        renderSlot={(_key, _owner, options) => {
          rendered.push(String((options as { only?: string } | undefined)?.only ?? ''))
          return <div />
        }}
        t={(key: string) => (key === 'inspector.tabs' ? zh['inspector.tabs'] : zh['details.close']) as never}
      />,
    )
    expect(rendered.at(-1)).toBe('files')
  })
})
