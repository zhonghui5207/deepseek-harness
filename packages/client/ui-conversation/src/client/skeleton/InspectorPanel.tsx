// InspectorPanel: tab strip + close over the active `details.tab` body.
// Geometry stays with ctx.layout; this column only chooses which tab is
// visible and writes that id through the shared chat store.

import { useSyncExternalStore } from 'react'
import clsx from 'clsx'
import type { DetailsSlotProps } from '../contract/slots.ts'
import type { ViewTab } from '../contract/views.ts'
import css from './InspectorPanel.module.css'

/** Full props composed by reference from the contract. */
export type InspectorPanelProps = DetailsSlotProps

/** Resolve the stored tab id against the live ledger; unknown ids fall to the first tab. */
function resolveActiveTab(tabs: readonly ViewTab[], selectedId: string | null): ViewTab | undefined {
  if (selectedId !== null) {
    const found = tabs.find(tab => tab.id === selectedId)
    if (found !== undefined) return found
  }
  return tabs[0]
}

/**
 * Right-column inspector chrome: Files / Details tabs and the close control.
 * @param props - store, tab ledger, render, close, and locale shares.
 * @returns the column shell.
 */
export function InspectorPanel({
  useStore, actions, renderSlot, closeDetails, tabs, t,
}: InspectorPanelProps) {
  useSyncExternalStore(tabs.subscribe, tabs.version)
  const list = tabs.list()
  const selectedId = useStore(s => s.detailsTab)
  const active = resolveActiveTab(list, selectedId)

  return (
    <div className={css.root} role="complementary" aria-label={t('inspector.tabs')}>
      <div className={css.header}>
        <div className={css.tabs} role="tablist" aria-label={t('inspector.tabs')}>
          {list.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === active?.id}
              className={clsx(css.tab, tab.id === active?.id && css.tabActive)}
              onClick={() => { actions.setDetailsTab(tab.id) }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button" className={css.close} aria-label={t('details.close')}
          onClick={() => { closeDetails() }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className={css.pane}>
        {active !== undefined && renderSlot('details.tab', {}, { only: active.id })}
      </div>
    </div>
  )
}
