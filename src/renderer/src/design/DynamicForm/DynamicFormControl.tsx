import { mdiDiceMultipleOutline } from '@mdi/js'
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
  registration: UseFormRegisterReturn
  /** What the form opens on for this field — the preset when there is one, the default if not. */
  initial: unknown
  onRoll: () => void
}

export function DynamicFormControl({
  field,
  registration,
  initial,
  onRoll,
}: DynamicFormControlProps) {
  const { t } = useTranslation()
  const say = useModelText()

  switch (field.kind) {
    case 'longText':
      return <textarea rows={4} className={cn(FIELD, 'h-auto py-1')} {...registration} />

    case 'boolean':
      return <input type="checkbox" className="size-4 self-start" {...registration} />

    case 'choice':
      return (
        <select className={FIELD} {...registration}>
          {!field.required && <option value="" />}
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>
              {say(option.label)}
            </option>
          ))}
        </select>
      )

    case 'color':
      return <input type="color" className={cn(FIELD, 'px-1')} {...registration} />

    case 'seed':
      return (
        <div className="flex items-center gap-2">
          <input type="number" className={FIELD_FILL} {...registration} />
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
          registration={registration}
          initial={typeof initial === 'string' && initial ? initial : undefined}
          placeholder={t('generation.dropPicture')}
        />
      )

    // An unknown kind renders as a plain input rather than making the form disappear —
    // CLAUDE.md, invariant 5.
    default:
      return <input type="text" className={FIELD} {...registration} />
  }
}
