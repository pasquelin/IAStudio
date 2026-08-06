import { zodResolver } from '@hookform/resolvers/zod'
import { mdiDiceMultipleOutline } from '@mdi/js'
import { useEffect, useMemo } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { FieldDescriptor } from '@shared/domain/model'
import { cn } from './cn'
import {
  buildBody,
  buildSchema,
  defaultValues,
  groupFields,
  isVisible,
  randomSeed,
  type FormValues,
} from './dynamic-form'
import { ToolButton } from './ToolButton'

const CONTROL = 'bg-surface border-border h-(--sc-control) rounded-(--radius-sc-sm) border px-2'

export type DynamicFormProps = {
  fields: readonly FieldDescriptor[]
  onSubmit: (body: FormValues) => void
  submitLabel: string
  busy?: boolean
}

function Control({
  field,
  registration,
  onRoll,
}: {
  field: FieldDescriptor
  registration: UseFormRegisterReturn
  onRoll: () => void
}) {
  const { t } = useTranslation()

  switch (field.kind) {
    case 'longText':
      return <textarea rows={4} className={cn(CONTROL, 'h-auto py-1')} {...registration} />

    case 'boolean':
      return <input type="checkbox" className="size-4 self-start" {...registration} />

    case 'choice':
      return (
        <select className={CONTROL} {...registration}>
          {!field.required && <option value="" />}
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )

    case 'color':
      return <input type="color" className={cn(CONTROL, 'px-1')} {...registration} />

    case 'seed':
      return (
        <div className="flex items-center gap-1">
          <input type="number" className={cn(CONTROL, 'min-w-0 flex-1')} {...registration} />
          <ToolButton
            icon={mdiDiceMultipleOutline}
            label={t('generation.randomSeed')}
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
          className={CONTROL}
          {...registration}
        />
      )

    // `image` and `raw` both land here. An unknown kind renders as a plain input rather than
    // making the form disappear — CLAUDE.md, invariant 5.
    default:
      return <input type="text" className={CONTROL} {...registration} />
  }
}

/**
 * Renders a form from the descriptors a model published. Nothing about any particular model
 * appears here: writing a form by hand for a given model is a bug, not a shortcut.
 */
export function DynamicForm({ fields, onSubmit, submitLabel, busy = false }: DynamicFormProps) {
  const { t } = useTranslation()
  const schema = useMemo(() => buildSchema(fields), [fields])
  const initial = useMemo(() => defaultValues(fields), [fields])

  const { register, handleSubmit, watch, setValue, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })

  // Switching model swaps the whole descriptor set: keeping the previous values would carry a
  // `guidance` from one model into another that never declared it.
  useEffect(() => reset(initial), [initial, reset])

  const values = watch()

  if (fields.length === 0) {
    return <p className="text-muted p-2 text-xs">{t('generation.noParameter')}</p>
  }

  return (
    <form
      className="flex flex-col gap-3 p-2"
      onSubmit={event =>
        void handleSubmit(submitted => onSubmit(buildBody(fields, submitted)))(event)
      }
    >
      {groupFields(fields).map(([group, groupedFields]) => (
        <fieldset key={group} className="m-0 flex flex-col gap-2 border-0 p-0">
          {group && (
            <legend className="text-muted p-0 text-[11px] tracking-wide uppercase">{group}</legend>
          )}

          {groupedFields
            .filter(field => isVisible(field, values))
            .map(field => (
              <label key={field.key} className="flex flex-col gap-1 text-xs">
                <span className="text-muted">
                  {field.label}
                  {field.required && <span aria-hidden> *</span>}
                </span>

                <Control
                  field={field}
                  registration={register(field.key, {
                    valueAsNumber: field.kind === 'number' || field.kind === 'integer',
                  })}
                  onRoll={() => setValue(field.key, randomSeed())}
                />

                {field.help && <span className="text-muted text-[11px]">{field.help}</span>}
                {formState.errors[field.key] && (
                  <span role="alert" className="text-danger text-[11px]">
                    {t('errors.invalidValue')}
                  </span>
                )}
              </label>
            ))}
        </fieldset>
      ))}

      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  )
}
