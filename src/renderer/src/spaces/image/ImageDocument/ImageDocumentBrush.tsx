import { mdiTune } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { CONTROL } from '@/design/styles'
import { TIP_RIGHT } from '@/helpers/tooltip'
import type { CanvasTool } from '@/engines/canvas/canvasTool'
import { BRUSH_SETTINGS_BY_TOOL, BRUSH_SIZE, type BrushSettings } from '@/engines/canvas/brush'
import { MenuButton } from '@/design/MenuButton'
import { SliderField } from '@/design/SliderField'

/**
 * The three settings the flyout offers, as a table: a fourth is one row here rather than a
 * fourth near-copy of the same slider. Colour is not one of them — it has its own input, and
 * a swatch is not a value anyone drags along a track.
 */
const BRUSH_FIELDS: readonly {
  of: 'size' | 'hardness' | 'opacity'
  /** Spelled out rather than built from `of`: a composed key is one no search can find. */
  labelKey: string
  min: number
  max: number
  step: number
}[] = [
  { of: 'size', labelKey: 'imageTools.size', min: BRUSH_SIZE.min, max: BRUSH_SIZE.max, step: 1 },
  // Twenty steps across the track: finer than that is a slider nobody can land on.
  { of: 'hardness', labelKey: 'imageTools.hardness', min: 0, max: 1, step: 0.05 },
  { of: 'opacity', labelKey: 'imageTools.opacity', min: 0, max: 1, step: 0.05 },
]

/**
 * The paint settings, showing only what the armed tool reads.
 *
 * A control the tool ignores is not greyed, it is gone — the rule the inspector already applies
 * to a sprite, which gets no shadow section at all rather than a dead one. The hardness slider
 * under the pencil was the case that named this: live, draggable, and moving nothing.
 *
 * The table is `BRUSH_SETTINGS_BY_TOOL`, and the engine reads the same one.
 */
export function ImageDocumentBrush({
  armed,
  brush,
  onBrush,
  shortcuts,
}: {
  /** What the engine is doing, not which button is lit: six groups map onto fewer tools. */
  armed: CanvasTool | null
  brush: BrushSettings
  onBrush: (next: BrushSettings) => void
  /** Read off the registry by the caller, so a remapped bracket key moves on the tooltip too. */
  shortcuts: { smaller: string; larger: string }
}) {
  const { t } = useTranslation()
  const reads = armed ? BRUSH_SETTINGS_BY_TOOL[armed] : []

  // Nothing to set is nothing to show: the pointer, the crop and the picker paint no pixel, and
  // a bar of live controls above them promised settings the gesture never reads. `null` and not
  // an empty wrapper — the bar is a flex row with a gap, which an empty child still spends.
  if (reads.length === 0) return null

  const fields = BRUSH_FIELDS.filter(field => reads.includes(field.of))
  const showsColor = reads.includes('color')

  return (
    <div className="flex flex-col items-center gap-2">
      {/*
        A native colour input, deliberately: macOS opens the system picker, which already has
        an eyedropper, swatches and HSL fields. Same reasoning as the native `<select>` in
        `CollectionBar`.
      */}
      {showsColor && (
        <input
          type="color"
          {...TIP_RIGHT(t('imageTools.color'), undefined, t('imageTools.colorHint'))}
          value={`#${brush.color.toString(16).padStart(6, '0')}`}
          onChange={event =>
            onBrush({ ...brush, color: Number.parseInt(event.target.value.slice(1), 16) })
          }
          className={cn(CONTROL, 'w-(--sc-control) cursor-pointer border-none p-0.5')}
        />
      )}

      {/*
        Behind a flyout rather than in the bar: this bar is one control wide, and three labelled
        sliders in a column that narrow are three sliders nobody can read. The brackets reach the
        size without opening anything, which is what the hand uses mid-stroke.
      */}
      {fields.length > 0 && (
        <MenuButton
          icon={mdiTune}
          label={t('imageTools.brushSettings')}
          // The bracket keys are named on the tooltip rather than on the slider: they resize
          // without opening anything, so the panel is the last place the hand learns about them.
          description={`${t('imageTools.brushSettingsHint')} — ${shortcuts.smaller} / ${shortcuts.larger}`}
          tooltip={TIP_RIGHT}
          opensOnClick
          menu={false}
          // `useHoverFlyout` treats a single row as no menu at all — and what it counts has to
          // be the rows actually drawn, not the table they were filtered from.
          rowCount={fields.length}
          rows={() => (
            <div className="flex w-56 flex-col gap-2 p-1">
              {fields.map(field => (
                <SliderField
                  key={field.of}
                  label={t(field.labelKey)}
                  value={brush[field.of]}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={value => onBrush({ ...brush, [field.of]: value })}
                />
              ))}
            </div>
          )}
        />
      )}
    </div>
  )
}
