import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Settings } from '@shared/domain/settings'
import { SNAP_KINDS, type SnapKind, type Snapping } from '@shared/domain/snap'
import { PropertySection } from '@/components/PropertySection'
import { SelectField } from '@/components/SelectField'
import { ToggleField } from '@/components/ToggleField'
import { useSnapReading } from '@/hooks/useSnapReading'
import { HINT_LEFT } from '@/helpers/tooltip'
import {
  SNAP_STEP_CONTROLS,
  type SnapStepControl,
} from '@/spaces/three/SceneSnapBar/sceneSnapControls'

export type EnvironmentSnapSectionProps = {
  view: Settings['three']
  onViewport: (patch: Partial<Settings['three']>) => void
  snapping: Snapping
  onSnap: (kind: SnapKind, on: boolean) => void
}

/**
 * The steps a drag advances by. WHETHER snapping is on is session state and how coarse it is is a
 * preference, which is why the two halves come from different places and meet only here.
 */
export function EnvironmentSnapSection({
  view,
  onViewport,
  snapping,
  onSnap,
}: EnvironmentSnapSectionProps) {
  const { t } = useTranslation()
  // The same reader the bar uses: written by hand here, a step read `0.25` where the viewport
  // read `0,25 m` — no unit, no symbol, and the decimal separator of no language in particular.
  const reading = useSnapReading(view.units)

  // 🛑 Held across renders, as the bar holds its own: the three fields format eight steps each,
  // and a dragged slider of a sister section re-renders this panel at pointer rate.
  const stepped = useMemo(
    () =>
      SNAP_STEP_CONTROLS.map(control => ({
        control,
        options: control.steps.map(step => ({
          value: String(step),
          label: reading(control.reads, step),
        })),
      })),
    [reading],
  )

  const hint = HINT_LEFT(t('environment.snapEnabledHint'))

  return (
    <PropertySection title={t('environment.snap')} defaultOpen={false} scId="snap">
      {SNAP_KINDS.map(kind => (
        <ToggleField
          key={kind}
          label={t(SNAP_LABELS[kind])}
          scId={`environment.snap.${kind}`}
          value={snapping[kind]}
          onChange={on => onSnap(kind, on)}
        />
      ))}

      {/* The three that HAVE steps, never the surface snap, which lands rather than advances:
          a step that changes nothing right now is a control that reads as broken. */}
      {SNAP_STEP_CONTROLS.some(control => snapping[control.kind]) && (
        <>
          {/* The preferences set these three by a free SLIDER, so a stored step can fall between
              two of the ones offered here — it then reads as itself rather than as the first. */}
          {stepped.map(({ control, options }) => (
            <SelectField
              key={control.kind}
              label={t(FIELD_KEYS[control.path])}
              scId={FIELD_KEYS[control.path]}
              value={String(view[control.path])}
              options={options}
              onChange={value => onViewport({ [control.path]: Number(value) })}
              unnamedLabel={reading(control.reads, view[control.path])}
              hint={hint}
            />
          ))}
        </>
      )}
    </PropertySection>
  )
}

/** Written out rather than composed: a key built at runtime is a key no guard can see. */
const SNAP_LABELS: Record<SnapKind, string> = {
  surface: 'snapBar.surface',
  translate: 'snapBar.translate',
  rotate: 'snapBar.rotate',
  scale: 'snapBar.scale',
}

/**
 * This panel's own words for the three, and its `scId`s. Not the bar's: under a section already
 * called « Magnétisme », « Magnétisme de grille » says it twice.
 */
const FIELD_KEYS: Record<SnapStepControl['path'], string> = {
  snapTranslate: 'environment.snapTranslate',
  snapRotate: 'environment.snapRotate',
  snapScale: 'environment.snapScale',
}
