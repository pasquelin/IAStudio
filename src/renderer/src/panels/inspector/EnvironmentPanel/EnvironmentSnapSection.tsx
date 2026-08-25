import { useTranslation } from 'react-i18next'
import type { Settings } from '@shared/domain/settings'
import {
  SNAP_KINDS,
  SNAP_ROTATE_STEPS,
  SNAP_SCALE_RATIOS,
  SNAP_TRANSLATE_STEPS,
  type SnapKind,
  type Snapping,
} from '@shared/domain/snap'
import { PropertySection } from '@/design/PropertySection'
import { SelectField } from '@/design/SelectField'
import { ToggleField } from '@/design/ToggleField'
import { HINT_LEFT } from '@/helpers/tooltip'

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

  const steps = (values: readonly number[], format: (value: number) => string = String) =>
    values.map(value => ({ value: String(value), label: format(value) }))

  const degrees = (value: number) => t('environment.snapDegrees', { value })
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
      {STEPPED_KINDS.some(kind => snapping[kind]) && (
        <>
          {/* The preferences set these three by a free SLIDER, so a stored step can fall between
              two of the ones offered here — it then reads as itself rather than as the first. */}
          <SelectField
            label={t('environment.snapTranslate')}
            scId="environment.snapTranslate"
            value={String(view.snapTranslate)}
            options={steps(SNAP_TRANSLATE_STEPS)}
            onChange={value => onViewport({ snapTranslate: Number(value) })}
            unnamedLabel={String(view.snapTranslate)}
            hint={hint}
          />

          <SelectField
            label={t('environment.snapRotate')}
            scId="environment.snapRotate"
            value={String(view.snapRotate)}
            options={steps(SNAP_ROTATE_STEPS, degrees)}
            onChange={value => onViewport({ snapRotate: Number(value) })}
            unnamedLabel={degrees(view.snapRotate)}
            hint={hint}
          />

          <SelectField
            label={t('environment.snapScale')}
            scId="environment.snapScale"
            value={String(view.snapScale)}
            options={steps(SNAP_SCALE_RATIOS)}
            onChange={value => onViewport({ snapScale: Number(value) })}
            unnamedLabel={String(view.snapScale)}
            hint={hint}
          />
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

/** The three a step applies to. The surface snap lands on something; it advances by nothing. */
const STEPPED_KINDS: readonly SnapKind[] = ['translate', 'rotate', 'scale']
