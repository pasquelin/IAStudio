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
      // The box is the FRAME and the strip is stacked UNDER the text rather than laid over it:
      // laid over, it covered the foot of the scrollbar, which four rows grow as soon as a prompt
      // runs long. `overflow-hidden` keeps the text inside the frame's corners.
      //
      // The resize grip stays on the TEXT, where it lands above the strip instead of in the
      // corner the microphone wants: a control has to reach the edge of what holds it.
      return (
        <div className={cn(FIELD, 'flex h-auto flex-col overflow-hidden p-0')}>
          <textarea
            id={id}
            rows={4}
            className="w-full resize-y bg-transparent px-2 py-1"
            {...registration}
          />

          {accessory && (
            <div className="flex items-center justify-end gap-2 px-1.5 pb-1">{accessory}</div>
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
