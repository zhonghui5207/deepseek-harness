/**
 * Files inspector plugin, browser half: contributes one session-header
 * action that opens the right column on the Files tab, and the Files tab
 * body that lists the session cwd through `host.listEntries`.
 */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { FilesAction } from './FilesAction.tsx'
import { FilesPanel } from './FilesPanel.tsx'
import { createFilesStore } from './stores.ts'
import { en, NS, zh, type FileKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Files inspector copy. */
    'files': FileKey
  }
}

export type { FilesActionProps } from './FilesAction.tsx'
export type { FilesPanelProps } from './FilesPanel.tsx'

/** Required services for locale, slots, listing, and layout. */
export const inject = ['sessions', 'slots', 'locale', 'layout', 'workspaces', 'connection']

/**
 * Client plugin body: register the dictionaries, header action, and Files tab.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-files: dictionaries')
  const filesStore = createFilesStore()

  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'files',
      order: 10,
      locale: NS,
      inject: (sessionId: SessionId) => ({
        openFiles: () => {
          const scoped = ctx.sessions.scope(sessionId)
          scoped?.get('conversation')?.openInspector('files')
          ctx.layout.openDetails()
        },
      }),
    }, FilesAction),
  )

  ctx.slots.inject(
    'details.tab',
    () => ctx.slots.register({
      name: 'details.tab',
      id: 'files',
      order: 0,
      label: () => ctx.locale.bind(NS)('tab.files'),
      locale: NS,
      store: filesStore,
      inject: () => ({
        isLoopback: ctx.connection.isLoopback,
        listEntries: (path: string, signal?: AbortSignal) => ctx.workspaces.listEntries(path, signal),
        openPath: (path: string) => {
          void ctx.workspaces.openPath(path).catch(() => {
            // Host/OS open failures stay silent in the Files row; the native
            // app surfaces its own error dialog when the path is unusable.
          })
        },
        hooks: { hostDescription: ctx.connection.hostDescription },
      }),
    }, FilesPanel),
  )
}
