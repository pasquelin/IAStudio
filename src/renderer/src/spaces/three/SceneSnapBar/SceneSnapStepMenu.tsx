import { useTranslation } from 'react-i18next'
import type { DisplayUnit } from '@shared/domain/scene'
import { Separator } from '@/design/Separator'
import { ValueGrid } from '@/design/ValueGrid/ValueGrid'
import { SNAP_READING_KEYS, SNAP_UNIT_KEYS, type SnapStepControl } from './sceneSnapControls'
import { snapFigure } from './snapFigure'

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
  const { t, i18n } = useTranslation()

  const optionsOf = (steps: readonly number[]) =>
    steps.map(step => ({
      value: step,
      label: t(SNAP_READING_KEYS[control.reads], {
        value: snapFigure(step, control.reads, unit, i18n.language),
        unit: t(SNAP_UNIT_KEYS[unit]),
      }),
    }))

  return (
    <div className="flex flex-col gap-0.5">
      <ValueGrid
        options={optionsOf(control.steps)}
        chosen={value}
        columns={control.columns}
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
            columns={control.columns}
            label={t('snapBar.rotateDivisions')}
            scId="snapBar.rotate.division"
            onChoose={onChoose}
          />
        </>
      )}
    </div>
  )
}
