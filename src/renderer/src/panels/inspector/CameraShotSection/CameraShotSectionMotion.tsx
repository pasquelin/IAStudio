import { useTranslation } from 'react-i18next'
import { EASINGS, type CameraMotion } from '@shared/domain/animation'
import { NumberField } from '@/design/NumberField'
import { NATIVE_SELECT, type GestureProps } from '@/design/styles'

export type CameraShotSectionMotionProps = {
  motion: CameraMotion
  onChange: (motion: CameraMotion) => void
  gesture: GestureProps
}

/**
 * How a camera travels its rail: at what speed curve, and between which two abscissae.
 *
 * `from` and `to` are 0..1 along the rail rather than seconds — the clock is the shot's window.
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
      <label className="flex items-center justify-between gap-2 px-2">
        <span className="text-muted text-tiny">{t('inspector.easing')}</span>
        <select
          value={motion.easing}
          // Read back off the list rather than asserted: what a select hands over is a string,
          // and a value no easing answers to would be written into the document.
          onChange={event => {
            const easing = EASINGS.find(candidate => candidate === event.target.value)
            if (easing) onChange({ ...motion, easing })
          }}
          className={NATIVE_SELECT}
        >
          {EASINGS.map(easing => (
            <option key={easing} value={easing}>
              {t(`inspector.easing_${easing}`)}
            </option>
          ))}
        </select>
      </label>

      <NumberField
        label={t('inspector.railFrom')}
        value={motion.from}
        min={0}
        max={1}
        step={0.05}
        onChange={from => onChange({ ...motion, from })}
        {...gesture}
      />
      <NumberField
        label={t('inspector.railTo')}
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
