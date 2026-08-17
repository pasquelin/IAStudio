import { mdiChevronDown } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flyout } from '@/design/Flyout'
import { MenuRow } from '@/design/MenuRow'
import { CANVAS_TRIGGER } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { HINT_RIGHT, HINT_TOP } from '@/helpers/tooltip'
import { PANE_VIEWS, type PaneView } from '@/engines/scene/scene-view'
import { PANE_VIEW_ICONS } from '../scene-tools'

export function ScenePaneGridMenu({
  view,
  onView,
  pane,
}: {
  view: PaneView
  onView: (view: PaneView) => void
  pane: number
}) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)

  const close = (): void => setOpen(false)

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        // The label is on screen, so the tooltip explains instead of repeating it.
        {...HINT_TOP(t('sceneViews.paneHint'))}
        aria-expanded={open}
        // The visible word comes FIRST in the accessible name: a reader who says "click Top"
        // has to reach the button that reads Top, and four panes make the number the only way
        // to tell them apart (WCAG SC 2.5.3).
        aria-label={t('sceneViews.pane', { number: pane + 1, view: t(`sceneViews.${view}`) })}
        onClick={() => setOpen(current => !current)}
        className={CANVAS_TRIGGER}
      >
        {t(`sceneViews.${view}`)}
        {/* The chevron is what says "this opens": a bare word reads as a caption, and the menu
            went unnoticed for exactly that reason. */}
        <UiIcon path={mdiChevronDown} size={12} />
      </button>

      {open && (
        <Flyout anchor={anchor} role="menu" onDismiss={close} onKeyClose={close}>
          {PANE_VIEWS.map(candidate => (
            <MenuRow
              key={candidate}
              label={t(`sceneViews.${candidate}`)}
              icon={PANE_VIEW_ICONS[candidate]}
              checked={candidate === view}
              tick="one-of"
              tip={HINT_RIGHT(t(`sceneViews.${candidate}Hint`))}
              onSelect={() => {
                onView(candidate)
                close()
              }}
            />
          ))}
        </Flyout>
      )}
    </>
  )
}
