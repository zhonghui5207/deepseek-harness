/**
 * Per-session Files-tab browse state. The plugin creates its handle at apply
 * time so identity follows the fiber; the slot framework caches one instance
 * per session.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Declared action shape used to give the exported factory a stable return type. */
type FilesActions = {
  setPath: (draft: FilesStoreState, path: string | undefined) => void
  setShowHidden: (draft: FilesStoreState, show: boolean) => void
}

/** Per-session Files tab path and hidden-entry preference. */
export interface FilesStoreState {
  /** Listed directory; undefined lists the session cwd. */
  path: string | undefined
  /** Whether dot-prefixed rows are visible. */
  showHidden: boolean
}

/**
 * Declares the per-session Files browse state and write surface.
 * @returns the store handle.
 */
export function createFilesStore(): EngineStoreHandle<FilesStoreState, FilesActions> {
  return defineStore({
    init: (): FilesStoreState => ({ path: undefined, showHidden: false }),
    persist: 'dsh.files.browse',
    actions: {
      setPath: (d, path: string | undefined) => { d.path = path },
      setShowHidden: (d, show: boolean) => { d.showHidden = show },
    },
  })
}
