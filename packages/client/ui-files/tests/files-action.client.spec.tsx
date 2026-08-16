// @vitest-environment jsdom
/** Session-header Files action opens the inspector. */
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilesAction, type FilesActionProps } from '../src/client/FilesAction.tsx'
import { zh } from '../src/client/locales.ts'

describe('FilesAction', () => {
  it('invokes openFiles from the header button', async () => {
    const user = userEvent.setup()
    const openFiles = vi.fn()
    const view = render(
      <FilesAction
        {...{
          sessionId: 's1',
          openFiles,
          t: (key: keyof typeof zh) => zh[key],
        } as unknown as FilesActionProps}
      />,
    )
    await user.click(view.getByRole('button', { name: zh['action.open'] }))
    expect(openFiles).toHaveBeenCalledTimes(1)
  })
})
