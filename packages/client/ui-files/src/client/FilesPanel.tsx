import { useEffect, useState } from 'react'
import type { HostDescriptionSource } from '@deepseek-ai/dsh-client-connection/client'
import type { PathListing } from '@deepseek-ai/dsh-client-runtime/client'
import { DirectoryBrowseError } from '@deepseek-ai/dsh-client-runtime/client'
import { IconFolderClose16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import type { createFilesStore } from './stores.ts'
import css from './FilesPanel.module.css'

/** Registration-side listing and Host capability facts. */
export interface FilesTabInjected {
  /** Whether the browser itself is connected over loopback. */
  isLoopback: boolean
  /**
   * List one mixed directory level.
   * @param path - absolute directory to list.
   * @param signal - aborts a superseded scan.
   */
  listEntries: (path: string, signal?: AbortSignal) => Promise<PathListing>
  /**
   * Open a path with the Host operating system's default application.
   * @param path - absolute host path.
   */
  openPath: (path: string) => void
  hooks: {
    /** Current generation's Host description, bound by the slot renderer. */
    hostDescription: HostDescriptionSource
  }
}

/** Full props for the Files inspector tab. */
export type FilesPanelProps =
  PropsRuntime<'details.tab'>
  & PropsStore<ReturnType<typeof createFilesStore>>
  & InjectFace<FilesTabInjected>
  & PropsLocale<typeof NS>

type ListingState =
  | { status: 'loading' }
  | { status: 'ready'; listing: PathListing }
  | { status: 'error'; message: string }

/**
 * One-level workspace file list rooted at the session cwd.
 * @param props - session kit, browse store, listing verbs, and locale.
 * @returns the Files tab body.
 */
export function FilesPanel({
  sessionId, useSessions, useStore, actions, isLoopback, listEntries, openPath,
  useHostDescription, t,
}: FilesPanelProps) {
  const sessionCwd = useSessions(list => list.byId[sessionId]?.cwd)
  const storedPath = useStore(s => s.path)
  const showHidden = useStore(s => s.showHidden)
  const target = storedPath ?? sessionCwd
  const hostCanOpenPath = useHostDescription(description => description?.canOpenPath === true)
  const canOpenPath = isLoopback && hostCanOpenPath
  const [state, setState] = useState<ListingState>({ status: 'loading' })

  useEffect(() => {
    if (target === undefined) {
      setState({ status: 'error', message: t('list.error') })
      return
    }
    const abort = new AbortController()
    setState({ status: 'loading' })
    void listEntries(target, abort.signal).then(
      (listing) => {
        if (!abort.signal.aborted) setState({ status: 'ready', listing })
      },
      (error: unknown) => {
        if (abort.signal.aborted) return
        const message = error instanceof DirectoryBrowseError
          ? error.rpcError.message
          : error instanceof Error ? error.message : t('list.error')
        setState({ status: 'error', message })
      },
    )
    return () => { abort.abort() }
  }, [listEntries, t, target])

  const listing = state.status === 'ready' ? state.listing : undefined
  const visible = listing?.entries.filter(entry => showHidden || !entry.hidden) ?? []

  return (
    <div className={css.root}>
      {listing !== undefined && (
        <nav className={css.crumbs} aria-label={t('crumbs.aria')}>
          {listing.crumbs.map((crumb, index) => {
            const last = index === listing.crumbs.length - 1
            return (
              <span key={crumb.path} className={css.crumbSeg}>
                {index > 0 && <span className={css.crumbSep}>/</span>}
                <button
                  type="button"
                  className={last ? `${css.crumb} ${css.crumbCurrent}` : css.crumb}
                  disabled={last}
                  onClick={() => { actions.setPath(crumb.path) }}
                >
                  {crumb.name}
                </button>
              </span>
            )
          })}
        </nav>
      )}
      <div className={css.toolbar}>
        <button
          type="button"
          className={css.hiddenToggle}
          aria-pressed={showHidden}
          onClick={() => { actions.setShowHidden(!showHidden) }}
        >
          {t('hidden.show')}
        </button>
      </div>
      {state.status === 'error' && <div className={css.empty}>{state.message}</div>}
      {state.status === 'ready' && visible.length === 0 && (
        <div className={css.empty}>{t('list.empty')}</div>
      )}
      {state.status === 'ready' && visible.length > 0 && (
        <ul className={css.list} aria-label={t('list.aria')}>
          {visible.map((entry) => {
            const directory = entry.kind === 'directory'
            return (
              <li key={entry.path}>
                <button
                  type="button"
                  className={css.row}
                  title={directory || canOpenPath ? entry.path : t('open.unavailable')}
                  disabled={!directory && !canOpenPath}
                  onClick={() => {
                    if (directory) {
                      actions.setPath(entry.path)
                      return
                    }
                    openPath(entry.path)
                  }}
                >
                  {directory
                    ? <IconFolderClose16 size={16} className={css.icon} />
                    : <span className={css.fileGlyph} aria-hidden />}
                  <span className={css.name}>{entry.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {listing?.truncated === true && (
        <div className={css.truncated}>{t('list.truncated', { count: String(listing.entries.length) })}</div>
      )}
    </div>
  )
}
