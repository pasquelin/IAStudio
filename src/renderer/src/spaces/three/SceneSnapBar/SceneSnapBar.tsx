import { mdiFormatVerticalAlignBottom, mdiRun } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { formatDecimal } from '@/helpers/format'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { ToggleMenu } from '@/design/ToggleMenu/ToggleMenu'
import { useViewportSetting } from '@/hooks/useViewportSetting'
import { useSceneViews, sceneViewOf } from '@/stores/sceneViews'
import { SNAP_READING_KEYS, SNAP_STEP_CONTROLS, SNAP_UNIT_KEYS } from './sceneSnapControls'
import { SceneSnapStepMenu } from './SceneSnapStepMenu'
import { SceneSnapSurfaceMenu } from './SceneSnapSurfaceMenu'
import { SceneSpeedMenu } from './SceneSpeedMenu'
import { snapFigure } from './snapFigure'

export type SceneSnapBarProps = {
  documentId: string
  /** The session speed the wheel writes in flight, or `null` while nothing has moved it. */
  speed: number | null
  onSpeed: (speed: number) => void
}

/**
 * What one changes WHILE manipulating: how fast the camera moves, and what a drag lands on.
 *
 * Floating over the viewport rather than sitting on the tab strip: it belongs to the 3D document
 * and follows it from window to window, where the strip is the shell's and knows nothing of which
 * space is open. Same footing as `SceneCounters` and the navigation hint.
 */
export function SceneSnapBar({ documentId, speed, onSpeed }: SceneSnapBarProps) {
  const { t, i18n } = useTranslation()
  const { view, set } = useViewportSetting()
  const snapping = useSceneViews(state => sceneViewOf(state, documentId).snapping)

  const flying = speed ?? view.flySpeed
  // The figure OPENS the accessible name, because it is what is on screen: a name that dropped it
  // would leave a speech-input user saying what they read and reaching nothing (WCAG 2.5.3).
  const named = (value: string, name: string) => t('snapBar.namedValue', { value, name })
  const reading = (control: (typeof SNAP_STEP_CONTROLS)[number]) =>
    t(SNAP_READING_KEYS[control.reads], {
      value: snapFigure(view[control.path], control.reads, view.units, i18n.language),
      unit: t(SNAP_UNIT_KEYS[view.units]),
    })
  const toggle = (kind: keyof typeof snapping) =>
    useSceneViews.getState().setSceneSnap(documentId, kind, !snapping[kind])

  return (
    <div className="bg-surface border-border absolute top-2 left-1/2 flex max-w-full -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-(--radius-sc-md) border p-0.5">
      <ToggleMenu
        icon={mdiRun}
        label={t('snapBar.speed')}
        description={t('snapBar.speedHint')}
        tooltip={TIP_BOTTOM}
        value={t('snapBar.speedValue', {
          value: formatDecimal(flying, i18n.language, { digits: 1 }),
        })}
        valueLabel={named(
          t('snapBar.speedValue', { value: formatDecimal(flying, i18n.language, { digits: 1 }) }),
          t('snapBar.speed'),
        )}
        rowCount={2}
        menu={false}
        rows={close => <SceneSpeedMenu speed={flying} onChoose={onSpeed} onClose={close} />}
      />

      <ToggleMenu
        icon={mdiFormatVerticalAlignBottom}
        label={t('snapBar.surface')}
        description={t('snapBar.surfaceHint')}
        tooltip={TIP_BOTTOM}
        pressed={snapping.surface}
        onToggle={() => toggle('surface')}
        value={t(view.snapSurfaceAlign ? 'snapBar.surfaceAligned' : 'snapBar.surfaceFlat')}
        valueLabel={named(
          t(view.snapSurfaceAlign ? 'snapBar.surfaceAligned' : 'snapBar.surfaceFlat'),
          t('snapBar.surfaceSettings'),
        )}
        rowCount={2}
        menu={false}
        rows={() => <SceneSnapSurfaceMenu view={view} onViewport={set} />}
      />

      {SNAP_STEP_CONTROLS.map(control => (
        <ToggleMenu
          key={control.kind}
          icon={control.icon}
          label={t(control.labelKey)}
          description={t(control.descriptionKey)}
          tooltip={TIP_BOTTOM}
          pressed={snapping[control.kind]}
          onToggle={() => toggle(control.kind)}
          value={reading(control)}
          valueLabel={named(reading(control), t(control.stepsKey))}
          rowCount={control.steps.length}
          rows={close => (
            <SceneSnapStepMenu
              control={control}
              unit={view.units}
              value={view[control.path]}
              onChoose={step => {
                set({ [control.path]: step })
                close()
              }}
            />
          )}
        />
      ))}
    </div>
  )
}
