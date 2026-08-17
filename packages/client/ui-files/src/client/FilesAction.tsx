import { IconFolderClose16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import css from './FilesAction.module.css'

/** Header action verbs: open the inspector on the Files tab. */
export interface FilesActionInjected {
  /** Select the Files tab and open the right column. */
  openFiles: () => void
}

/** Full props for the session-header Files action. */
export type FilesActionProps =
  PropsRuntime<'conversation.session.header.actions'>
  & InjectFace<FilesActionInjected>
  & PropsLocale<typeof NS>

/**
 * Session-header folder control that opens the right inspector on Files.
 * @param props - runtime slot currency, open callback, and locale.
 * @returns the header button.
 */
export function FilesAction({ openFiles, t }: FilesActionProps) {
  return (
    <button
      type="button"
      className={css.trigger}
      aria-label={t('action.open')}
      onClick={() => { openFiles() }}
    >
      <IconFolderClose16 size={16} />
    </button>
  )
}
