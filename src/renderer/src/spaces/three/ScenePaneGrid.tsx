import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flyout } from '@/design/Flyout'
import { MenuRow } from '@/design/MenuRow'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT, HINT_TOP } from '@/helpers/tooltip'
import { PANE_VIEWS, type PaneView } from '@/engines/scene/scene-view'
import { PANE_VIEW_ICONS } from './scene-tools'

export type ScenePaneGridProps = {
  views: readonly PaneView[]
  onView: (pane: number, view: PaneView) => void
}

/**
 * The seams between the four views, and what each of them shows.
 *
 * The gutters are drawn in the DOM over the canvas rather than left to the renderer: a gap
 * between two panes would be a strip the scissor never clears, so it would hold whatever the
 * last frame left in it. Laid over them it is the same gutter the shell puts between its panels,
 * follows the theme, and costs the GPU nothing.
 *
 * Each name is also the way to change it. Four views of an empty grid are four identical
 * rectangles: an editor that cannot say which one is the top view — nor let one say so — is an
 * editor one has to turn a camera in to find out.
 */
export function ScenePaneGrid({ views, onView }: ScenePaneGridProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* The two gutters, at the width the shell uses between its own panels. */}
      <div className="bg-chassis absolute inset-y-0 left-1/2 w-(--sc-gutter) -translate-x-1/2" />
      <div className="bg-chassis absolute inset-x-0 top-1/2 h-(--sc-gutter) -translate-y-1/2" />

      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
        {[0, 1, 2, 3].map(pane => (
          <div key={pane} className="min-w-0 p-1.5">
            <PaneMenu
              view={views[pane] ?? 'free'}
              onView={chosen => onView(pane, chosen)}
              pane={pane}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function PaneMenu({
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
        aria-label={t('sceneViews.pane', { number: pane + 1 })}
        onClick={() => setOpen(current => !current)}
        className={cn(
          // Pointer events back on: the grid above turns them off so a drag reaches the canvas.
          'text-muted hover:text-text bg-panel/80 pointer-events-auto cursor-pointer',
          'text-mini rounded-(--radius-sc-sm) border-none px-1.5 py-0.5',
        )}
      >
        {t(`sceneViews.${view}`)}
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
