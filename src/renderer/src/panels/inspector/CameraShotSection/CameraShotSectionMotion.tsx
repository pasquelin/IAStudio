import { useTranslation } from 'react-i18next'
import { EASINGS, type CameraMotion } from '@shared/domain/animation'
import { NumberField } from '@/design/NumberField'
import { SelectField } from '@/design/SelectField'
import type { GestureProps } from '@/design/styles'

export type CameraShotSectionMotionProps = {
  motion: CameraMotion
  onChange: (motion: CameraMotion) => void
  gesture: GestureProps
}

/**
 * How a camera travels its rail: at what speed curve, and between which two abscissae.
 *
 * `from` greater than `to` runs the rail backwards, which is why neither is clamped to the other.
 */
export function CameraShotSectionMotion({
  motion,
  onChange,
  gesture,
}: CameraShotSectionMotionProps) {
  const { t } = useTranslation()

  return (
    <>
      <SelectField
        label={t('inspector.easing')}
        value={motion.easing}
        options={EASINGS.map(easing => ({
          value: easing,
          label: t(`inspector.easing_${easing}`),
        }))}
        onChange={easing => onChange({ ...motion, easing })}
        scId="shot.easing"
      />

      <NumberField
        label={t('inspector.railFrom')}
        scId="camera.railFrom"
        value={motion.from}
        min={0}
        max={1}
        step={0.05}
        onChange={from => onChange({ ...motion, from })}
        {...gesture}
      />
      <NumberField
        label={t('inspector.railTo')}
        scId="camera.railTo"
        value={motion.to}
        min={0}
        max={1}
        step={0.05}
        onChange={to => onChange({ ...motion, to })}
        {...gesture}
      />
    </>
  )
}
