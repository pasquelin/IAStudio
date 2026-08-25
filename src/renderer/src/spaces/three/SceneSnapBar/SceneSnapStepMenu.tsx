import { useTranslation } from 'react-i18next'
import type { DisplayUnit } from '@shared/domain/scene'
import { MenuRow } from '@/design/MenuRow'
import { HINT_BOTTOM } from '@/helpers/tooltip'
import { SNAP_READING_KEYS, SNAP_UNIT_KEYS, type SnapStepControl } from './sceneSnapControls'
import { snapFigure } from './snapFigure'

export type SceneSnapStepMenuProps = {
  control: SnapStepControl
  unit: DisplayUnit
  /** What the preference holds. Compared by value, so a stored step off the list ticks nothing. */
  value: number
  onChoose: (step: number) => void
}

/**
 * The values one snap advances by. Two columns for the angle and one for the rest — the second
 * column is 360 divided by a power of two, which is what spreading *n* objects round a circle
 * needs and what no list of round increments contains.
 */
export function SceneSnapStepMenu({ control, unit, value, onChoose }: SceneSnapStepMenuProps) {
  const { t, i18n } = useTranslation()

  const rowsOf = (steps: readonly number[]) =>
    steps.map(step => (
      <MenuRow
        key={step}
        label={t(SNAP_READING_KEYS[control.reads], {
          value: snapFigure(step, control.reads, unit, i18n.language),
          unit: t(SNAP_UNIT_KEYS[unit]),
        })}
        checked={step === value}
        tick="one-of"
        tip={HINT_BOTTOM(t(control.descriptionKey))}
        onSelect={() => onChoose(step)}
      />
    ))

  if (!control.divisions) return rowsOf(control.steps)

  return (
    <div className="flex gap-2">
      <div>{rowsOf(control.steps)}</div>
      <div className="border-border border-l">{rowsOf(control.divisions)}</div>
    </div>
  )
}
