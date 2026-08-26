import { useTranslation } from 'react-i18next'
import { boundsOf } from '@shared/domain/settingsRegistry'
import { FLY_SPEEDS } from '@shared/domain/snap'
import { Separator } from '@/design/Separator'
import { Slider } from '@/design/Slider'
import { ValueGrid } from '@/design/ValueGrid/ValueGrid'
import { useSpeedReading } from '@/hooks/useSpeedReading'

// Read once: the registry answers by walking every descriptor.
const SPEED = boundsOf('three.flySpeed')

export type SceneSpeedMenuProps = {
  speed: number
  onChoose: (speed: number) => void
  /** Closes the menu. Spent by the rungs, never by the slider, which is dragged in place. */
  onClose: () => void
}

/**
 * Rungs and the free run between them. It writes the SESSION speed the wheel writes in flight —
 * two speeds that did not talk to each other would be the defect this control exists to avoid.
 *
 * `Slider` rather than `SliderField`: that one is a property LINE — label, track, readout and a
 * two-control action column that leans into a panel's padding. In a flyout the track collapsed to
 * nothing, so the handle could not be dragged at all, and the reset button hung off the edge.
 */
export function SceneSpeedMenu({ speed, onChoose, onClose }: SceneSpeedMenuProps) {
  const { t } = useTranslation()
  const reading = useSpeedReading()

  return (
    <div className="flex flex-col gap-0.5">
      <ValueGrid
        options={FLY_SPEEDS.map(rung => ({ value: rung, label: reading(rung) }))}
        chosen={speed}
        label={t('snapBar.speed')}
        scId="snapBar.speed.rung"
        onChoose={value => {
          onChoose(value)
          onClose()
        }}
      />

      <Separator orientation="horizontal" className="mx-auto" />

      <div className="flex items-center gap-2 px-1">
        <Slider
          value={speed}
          min={SPEED.min}
          max={SPEED.max}
          step={0.5}
          scId="snapBar.speed"
          onChange={onChoose}
          className="flex-1"
        />
        <span className="text-tiny text-muted shrink-0 tabular-nums">{reading(speed)}</span>
      </div>
    </div>
  )
}
