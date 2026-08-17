import { mdiDiceMultipleOutline } from '@mdi/js'
import type { ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { FieldDescriptor } from '@shared/domain/model'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useModelText } from '@/hooks/useModelText'
import { AssetDropField } from '../AssetDropField'
import { FIELD, FIELD_FILL } from '../styles'
import { ToolButton } from '../ToolButton'

export type DynamicFormControlProps = {
  field: FieldDescriptor
  /** The control's own id, so the form's label can name it without wrapping it. */
  id: string
  registration: UseFormRegisterReturn
  /** What the form opens on for this field — the preset when there is one, the default if not. */
  initial: unknown
  onRoll: () => void
  /** What the form hangs in this field, or nothing. Only a long text box has room for one. */
  accessory?: ReactNode
}

export function DynamicFormControl({
  field,
  id,
  registration,
  initial,
  onRoll,
  accessory,
}: DynamicFormControlProps) {
  const { t } = useTranslation()
  const say = useModelText()

  switch (field.kind) {
    case 'longText':
      return (
        <div className="relative">
          {/* `pb-7` and not a gap: the strip is laid OVER the box, so the room it takes has to be
              taken out of the text's own, or a line scrolls under the microphone. */}
          <textarea
            id={id}
            rows={4}
            className={cn(FIELD, 'h-auto w-full resize-none py-1', accessory ? 'pb-7' : '')}
            {...registration}
          />

          {accessory && (
            // Opaque, and inside the border rather than over it: what scrolls past has to be
            // hidden, and a strip drawn on the border would cut the box's own outline.
            <div className="bg-surface absolute inset-x-px bottom-px flex items-center justify-end gap-2 rounded-b-(--radius-sc-sm) px-1.5 py-1">
              {accessory}
            </div>
          )}
        </div>
      )

    case 'boolean':
      return <input id={id} type="checkbox" className="size-4 self-start" {...registration} />

    case 'choice':
      return (
        <select id={id} className={FIELD} {...registration}>
          {!field.required && <option value="" />}
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>
              {say(option.label)}
            </option>
          ))}
        </select>
      )

    case 'color':
      return <input id={id} type="color" className={cn(FIELD, 'px-1')} {...registration} />

    case 'seed':
      return (
        <div className="flex items-center gap-2">
          <input id={id} type="number" className={FIELD_FILL} {...registration} />
          <ToolButton
            icon={mdiDiceMultipleOutline}
            label={t('generation.randomSeed')}
            tooltip={TIP_LEFT}
            onClick={onRoll}
          />
        </div>
      )

    case 'number':
    case 'integer':
      return (
        <input
          id={id}
          type="number"
          step={field.step ?? (field.kind === 'integer' ? 1 : 'any')}
          min={field.min}
          max={field.max}
          className={FIELD}
          {...registration}
        />
      )

    case 'image':
      return (
        <AssetDropField
          id={id}
          registration={registration}
          initial={typeof initial === 'string' && initial ? initial : undefined}
          placeholder={t('generation.dropPicture')}
        />
      )

    // An unknown kind renders as a plain input rather than making the form disappear —
    // CLAUDE.md, invariant 5.
    default:
      return <input id={id} type="text" className={FIELD} {...registration} />
  }
}
