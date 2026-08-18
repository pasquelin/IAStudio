import { mdiChevronDown } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flyout } from '@/design/Flyout'
import { MenuRow } from '@/design/MenuRow'
import { CANVAS_TRIGGER } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { HINT_RIGHT, HINT_TOP } from '@/helpers/tooltip'
import { isCameraView, PANE_VIEWS, type PaneView } from '@/engines/scene/sceneView'
import { CAMERA_ICON } from '@/engines/scene/nodeKinds'
import { PANE_VIEW_ICONS } from '../sceneTools'

/** What a pane names itself: a word for the fixed views, the camera's own name for a locked one. */
function labelOf(view: PaneView, cameras: readonly SceneCamera[], t: (key: string) => string) {
  if (!isCameraView(view)) return t(`sceneViews.${view}`)
  return cameras.find(camera => camera.id === view.nodeId)?.name ?? t('sceneViews.free')
}

/** A camera of the scene, as a menu needs to offer one. */
export type SceneCamera = { id: string; name: string }

export function ScenePaneGridMenu({
  view,
  cameras,
  onView,
  pane,
}: {
  view: PaneView
  cameras: readonly SceneCamera[]
  onView: (view: PaneView) => void
  pane: number
}) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)

  const close = (): void => setOpen(false)
  const label = labelOf(view, cameras, t)

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
        aria-label={t('sceneViews.pane', { number: pane + 1, view: label })}
        onClick={() => setOpen(current => !current)}
        className={CANVAS_TRIGGER}
      >
        {label}
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
          {/* The cameras of the scene, under the fixed views: looking THROUGH one is what turns
              this pane into a monitor, and orbiting in it then moves that camera. */}
          {cameras.map(camera => (
            <MenuRow
              key={camera.id}
              label={camera.name}
              icon={CAMERA_ICON}
              checked={isCameraView(view) && view.nodeId === camera.id}
              tick="one-of"
              tip={HINT_RIGHT(t('sceneViews.throughCameraHint'))}
              onSelect={() => {
                onView({ kind: 'camera', nodeId: camera.id })
                close()
              }}
            />
          ))}
        </Flyout>
      )}
    </>
  )
}
