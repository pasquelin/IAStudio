import { useTranslation } from 'react-i18next'
import type { DisplayUnit } from '@shared/domain/scene'
import { Separator } from '@/design/Separator'
import { ValueGrid } from '@/design/ValueGrid/ValueGrid'
import { useSnapReading } from '@/hooks/useSnapReading'
import type { SnapStepControl } from './sceneSnapControls'

export type SceneSnapStepMenuProps = {
  control: SnapStepControl
  unit: DisplayUnit
  /** What the preference holds. Compared by value, so a stored step off the list marks nothing. */
  value: number
  onChoose: (step: number) => void
}

/**
 * The values one snap advances by, in columns. The angle keeps its two families — increments,
 * then 360 divided by a power of two, which is what spreading *n* objects round a circle needs —
 * stacked rather than side by side, so both spread over the same width.
 */
export function SceneSnapStepMenu({ control, unit, value, onChoose }: SceneSnapStepMenuProps) {
  const { t } = useTranslation()
  const reading = useSnapReading(unit)

  const optionsOf = (steps: readonly number[]) =>
    steps.map(step => ({ value: step, label: reading(control.reads, step) }))

  return (
    <div className="flex flex-col gap-0.5">
      <ValueGrid
        options={optionsOf(control.steps)}
        chosen={value}
        label={t(control.stepsKey)}
        scId={`snapBar.${control.kind}.step`}
        onChoose={onChoose}
      />

      {control.divisions && (
        <>
          <Separator orientation="horizontal" className="mx-auto" />
          <ValueGrid
            options={optionsOf(control.divisions)}
            chosen={value}
            label={t('snapBar.rotateDivisions')}
            scId="snapBar.rotate.division"
            onChoose={onChoose}
          />
        </>
      )}
    </div>
  )
}
