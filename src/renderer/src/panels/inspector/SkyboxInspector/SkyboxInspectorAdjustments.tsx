import { useTranslation } from 'react-i18next'
import { NEUTRAL_ADJUSTMENTS, type AdjustmentStack } from '@shared/domain/adjustments'
import { SliderField } from '@/design/SliderField'
import { ADJUSTMENT_FIELDS } from '@/engines/skybox/adjustmentFields'

export type SkyboxInspectorAdjustmentsProps = {
  adjustments: AdjustmentStack
  onChange: (key: keyof AdjustmentStack, value: number) => void
  onGestureStart: () => void
  onGestureEnd: () => void
}

/**
 * Every adjustment, rendered from `ADJUSTMENT_FIELDS` rather than written out — a grading step
 * added to the stack has a slider here without anyone remembering to draw one.
 */
export function SkyboxInspectorAdjustments({
  adjustments,
  onChange,
  onGestureStart,
  onGestureEnd,
}: SkyboxInspectorAdjustmentsProps) {
  const { t } = useTranslation()

  return (
    <>
      {ADJUSTMENT_FIELDS.map(field => (
        <SliderField
          key={field.key}
          label={t(field.labelKey)}
          value={adjustments[field.key]}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={value => onChange(field.key, value)}
          // Neutral is what a grading step does nothing at — the one value a reset can mean here.
          onReset={
            adjustments[field.key] === NEUTRAL_ADJUSTMENTS[field.key]
              ? undefined
              : () => onChange(field.key, NEUTRAL_ADJUSTMENTS[field.key])
          }
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
      ))}
    </>
  )
}
