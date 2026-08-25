import { useTranslation } from 'react-i18next'
import { boundsOf } from '@shared/domain/settingsRegistry'
import { FLY_SPEEDS } from '@shared/domain/snap'
import { MenuRow } from '@/design/MenuRow'
import { SliderField } from '@/design/SliderField'
import { formatDecimal } from '@/helpers/format'
import { HINT_BOTTOM } from '@/helpers/tooltip'

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
 * The flyout hosting it is told it is not a menu: `role="menu"` over a slider sends a screen
 * reader looking for rows to step through, and it would find one that is not a row.
 */
export function SceneSpeedMenu({ speed, onChoose, onClose }: SceneSpeedMenuProps) {
  const { t, i18n } = useTranslation()

  return (
    <div className="w-44">
      {/* The rungs carry `role="menuitemradio"`, which is only valid inside a `menu` — and the
          flyout cannot be one, since it also holds a slider. So the menu is this block, and the
          slider sits outside it. */}
      <div role="menu">
        {FLY_SPEEDS.map(rung => (
          <MenuRow
            key={rung}
            label={t('snapBar.speedValue', {
              value: formatDecimal(rung, i18n.language, { digits: 1 }),
            })}
            checked={rung === speed}
            tick="one-of"
            tip={HINT_BOTTOM(t('snapBar.speedHint'))}
            onSelect={() => {
              onChoose(rung)
              onClose()
            }}
          />
        ))}
      </div>
      <div className="border-border mt-1 border-t p-1">
        <SliderField
          label={t('snapBar.speedFree')}
          scId="snapBar.speed"
          value={speed}
          min={SPEED.min}
          max={SPEED.max}
          step={0.5}
          onChange={onChoose}
        />
      </div>
    </div>
  )
}
