import { useTranslation } from 'react-i18next'
import type { AdjustmentStack } from '@shared/domain/adjustments'
import { SliderField } from '@/design/SliderField'
import { ADJUSTMENT_FIELDS } from '@/engines/skybox/adjustmentFields'

export type AdjustmentSlidersProps = {
  adjustments: AdjustmentStack
  onChange: (key: keyof AdjustmentStack, value: number) => void
  onGestureStart: () => void
  onGestureEnd: () => void
}

/**
 * Every adjustment, rendered from `ADJUSTMENT_FIELDS`. Used twice — under the viewport and in
 * the panel — so that the two are the same controls rather than two lists that drift apart.
 */
export function AdjustmentSliders({
  adjustments,
  onChange,
  onGestureStart,
  onGestureEnd,
}: AdjustmentSlidersProps) {
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
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
      ))}
    </>
  )
}
