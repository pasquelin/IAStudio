import { useTranslation } from 'react-i18next'
import type { Settings } from '@shared/domain/settings'
import { PropertySection } from '@/design/PropertySection'
import { SelectField } from '@/design/SelectField'
import { ToggleField } from '@/design/ToggleField'
import { HINT_LEFT } from '@/helpers/tooltip'

export type EnvironmentSnapSectionProps = {
  view: Settings['three']
  onViewport: (patch: Partial<Settings['three']>) => void
  snapping: boolean
  onSnapping: (snapping: boolean) => void
}

/**
 * The steps a drag advances by. WHETHER snapping is on is session state and how coarse it is is a
 * preference, which is why the two halves come from different places and meet only here.
 */
export function EnvironmentSnapSection({
  view,
  onViewport,
  snapping,
  onSnapping,
}: EnvironmentSnapSectionProps) {
  const { t } = useTranslation()

  const steps = (values: readonly number[], format: (value: number) => string = String) =>
    values.map(value => ({ value: String(value), label: format(value) }))

  const degrees = (value: number) => t('environment.snapDegrees', { value })
  const hint = HINT_LEFT(t('environment.snapEnabledHint'))

  return (
    <PropertySection title={t('environment.snap')} defaultOpen={false} scId="snap">
      <ToggleField label={t('environment.snapEnabled')} value={snapping} onChange={onSnapping} />

      {/* Shown only while it is on: a step that changes nothing right now is a control that
          reads as broken, and the toggle above is one click away. */}
      {snapping && (
        <>
          {/* The preferences set these three by a free SLIDER, so a stored step can fall between
              two of the ones offered here — it then reads as itself rather than as the first. */}
          <SelectField
            label={t('environment.snapTranslate')}
            value={String(view.snapTranslate)}
            options={steps(TRANSLATE_STEPS)}
            onChange={value => onViewport({ snapTranslate: Number(value) })}
            unnamedLabel={String(view.snapTranslate)}
            hint={hint}
          />

          <SelectField
            label={t('environment.snapRotate')}
            value={String(view.snapRotate)}
            options={steps(ROTATE_STEPS, degrees)}
            onChange={value => onViewport({ snapRotate: Number(value) })}
            unnamedLabel={degrees(view.snapRotate)}
            hint={hint}
          />

          <SelectField
            label={t('environment.snapScale')}
            value={String(view.snapScale)}
            options={steps(SCALE_STEPS)}
            onChange={value => onViewport({ snapScale: Number(value) })}
            unnamedLabel={String(view.snapScale)}
            hint={hint}
          />
        </>
      )}
    </PropertySection>
  )
}

/** In scene units, which are metres. A millimetre through to a metre. */
const TRANSLATE_STEPS: readonly number[] = [0.001, 0.01, 0.1, 0.5, 1]

/** Degrees. The angles a set is actually laid out on, from a nudge to a quarter turn. */
const ROTATE_STEPS: readonly number[] = [1, 5, 10, 15, 30, 45, 90]

const SCALE_STEPS: readonly number[] = [0.01, 0.05, 0.1, 0.25, 0.5]
