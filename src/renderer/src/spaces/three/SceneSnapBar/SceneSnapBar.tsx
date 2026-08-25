import { mdiFormatVerticalAlignBottom, mdiRun } from '@mdi/js'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { PANE_TOOLBAR_ASIDE } from '@/design/styles'
import { Toolbar } from '@/design/Toolbar/Toolbar'
import { FLY_SPEEDS } from '@shared/domain/snap'
import { formatDecimal } from '@/helpers/format'
import { tipFor } from '@/helpers/tooltip'
import { Separator } from '@/design/Separator'
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
  const readingOf = (control: (typeof SNAP_STEP_CONTROLS)[number], step: number) =>
    t(SNAP_READING_KEYS[control.reads], {
      value: snapFigure(step, control.reads, view.units, i18n.language),
      unit: t(SNAP_UNIT_KEYS[view.units]),
    })
  const speedReading = (value: number) =>
    t('snapBar.speedValue', { value: formatDecimal(value, i18n.language, { digits: 1 }) })
  // The longest reading a control can show, so its box stops resizing under a dragged slider.
  // By characters, which is exact here: every figure is drawn `tabular-nums`.
  const widestOf = (labels: readonly string[]) =>
    labels.reduce((longest, label) => (label.length > longest.length ? label : longest), '')

  const toggle = (kind: keyof typeof snapping) =>
    useSceneViews.getState().setSceneSnap(documentId, kind, !snapping[kind])

  return (
    // The studio's own bar, laid horizontally — not a box of its own. Written by hand it had a
    // different radius, a different padding and no shadow, and read as a second kind of furniture
    // beside the tool column. Every control is two zones, so none of them is a `ToolbarItem`:
    // they all go through `extras`, which is what it is for.
    <Toolbar
      orientation="horizontal"
      label={t('snapBar.title')}
      className={PANE_TOOLBAR_ASIDE}
      extras={
        <>
          <ToggleMenu
            icon={mdiRun}
            scId="snapBar.speed"
            label={t('snapBar.speed')}
            description={t('snapBar.speedHint')}
            tooltip={tipFor('horizontal')}
            value={speedReading(flying)}
            widest={widestOf(FLY_SPEEDS.map(speedReading))}
            valueLabel={named(speedReading(flying), t('snapBar.speed'))}
            rowCount={2}
            rows={close => <SceneSpeedMenu speed={flying} onChoose={onSpeed} onClose={close} />}
          />

          <Separator />

          <ToggleMenu
            icon={mdiFormatVerticalAlignBottom}
            scId="snapBar.surface"
            label={t('snapBar.surface')}
            description={t('snapBar.surfaceHint')}
            tooltip={tipFor('horizontal')}
            pressed={snapping.surface}
            onToggle={() => toggle('surface')}
            value={t(view.snapSurfaceAlign ? 'snapBar.surfaceAligned' : 'snapBar.surfaceFlat')}
            widest={widestOf([t('snapBar.surfaceAligned'), t('snapBar.surfaceFlat')])}
            valueLabel={named(
              t(view.snapSurfaceAlign ? 'snapBar.surfaceAligned' : 'snapBar.surfaceFlat'),
              t('snapBar.surfaceSettings'),
            )}
            rowCount={2}
            rows={() => <SceneSnapSurfaceMenu view={view} onViewport={set} />}
          />

          {SNAP_STEP_CONTROLS.map(control => (
            <Fragment key={control.kind}>
              <Separator />
              <ToggleMenu
                icon={control.icon}
                scId={`snapBar.${control.kind}`}
                label={t(control.labelKey)}
                description={t(control.descriptionKey)}
                tooltip={tipFor('horizontal')}
                pressed={snapping[control.kind]}
                onToggle={() => toggle(control.kind)}
                value={readingOf(control, view[control.path])}
                widest={widestOf(
                  [...control.steps, ...(control.divisions ?? [])].map(step =>
                    readingOf(control, step),
                  ),
                )}
                valueLabel={named(readingOf(control, view[control.path]), t(control.stepsKey))}
                rowCount={control.steps.length}
                rows={close => (
                  <SceneSnapStepMenu
                    control={control}
                    unit={view.units}
                    value={view[control.path]}
                    // Arms it too: reaching for a step IS asking for that snap, and leaving the
                    // choice inert made every first use cost a second click. Arbitrage d'Alban —
                    // it is where this bar parts from Unreal, which leaves the toggle alone.
                    onChoose={step => {
                      set({ [control.path]: step })
                      useSceneViews.getState().setSceneSnap(documentId, control.kind, true)
                      close()
                    }}
                  />
                )}
              />
            </Fragment>
          ))}
        </>
      }
    />
  )
}
