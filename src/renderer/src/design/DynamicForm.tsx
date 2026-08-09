import { zodResolver } from '@hookform/resolvers/zod'
import { mdiDiceMultipleOutline } from '@mdi/js'
import { Fragment, useEffect, useMemo, type ReactNode } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { FieldDescriptor } from '@shared/domain/model'
import { cn } from '@/helpers/cn'
import {
  buildBody,
  defaultValues,
  dependencyKeys,
  groupFields,
  isNumeric,
  randomSeed,
  visibleFields,
  type FormValues,
} from '@/helpers/dynamic-form'
import { buildSchema } from '@/helpers/dynamic-form-schema'
import { useModelText } from '@/hooks/useModelText'
import { Button } from './Button'
import { AssetDropField } from './AssetDropField'
import { FIELD } from './styles'
import { ToolButton } from './ToolButton'

export type DynamicFormProps = {
  fields: readonly FieldDescriptor[]
  /**
   * Absent where the form is not run but read into something — a node's parameters, which the
   * graph executes later. The button then has nothing to say and is not drawn.
   */
  onSubmit?: (body: FormValues) => void
  submitLabel?: string
  /** Beside the label on the button, for what the form costs. Absent draws nothing. */
  submitNote?: string
  /**
   * The body as it stands, on every edit. A subscription rather than a watched value: rendering
   * on each keystroke is what the dependency watch below goes out of its way to avoid.
   */
  onValuesChange?: (body: FormValues) => void
  busy?: boolean
  /**
   * Values to open on, over each field's own default. What "regenerate with these parameters"
   * hands in; keys the model never declared are ignored, since a set kept from another model
   * would reach fields that do not exist.
   */
  preset?: FormValues
  /**
   * Rendered under each field, for whatever the caller wants to hang there — prompt assistance
   * hangs on the one the model marks. Called for every field so that nothing about any
   * particular feature is decided here; answering `null` leaves the field alone.
   *
   * The handle is what makes it worth a hook rather than a sibling: both halves live inside
   * this component. `read` is a getter rather than a value on purpose — watching the field
   * would re-render it on every keystroke, for something only a click ever asks for.
   */
  accessory?: (field: FieldDescriptor, handle: FieldHandle) => ReactNode
}

export type FieldHandle = {
  /** The field's value as it stands. Call it when acting, never while rendering. */
  read: () => unknown
  /** Fills this field alone, leaving every other one as the user set it. */
  write: (value: string) => void
  /**
   * Every field's value, for an accessory whose action depends on more than the one it hangs
   * under — prompt assistance conditions on the reference pictures sitting elsewhere on the
   * form. Same rule as `read`: call it when acting, never while rendering.
   */
  readAll: () => FormValues
}

function Control({
  field,
  registration,
  initial,
  onRoll,
}: {
  field: FieldDescriptor
  registration: UseFormRegisterReturn
  /** What the form opens on for this field — the preset when there is one, the default if not. */
  initial: unknown
  onRoll: () => void
}) {
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
          <input type="number" className={cn(FIELD, 'min-w-0 flex-1')} {...registration} />
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

/**
 * Renders a form from the descriptors a model published. Nothing about any particular model
 * appears here: writing a form by hand for a given model is a bug, not a shortcut.
 */
export function DynamicForm({
  fields,
  onSubmit,
  submitLabel,
  submitNote,
  onValuesChange,
  busy = false,
  preset,
  accessory,
}: DynamicFormProps) {
  const { t } = useTranslation()
  const say = useModelText()
  const schema = useMemo(() => buildSchema(fields), [fields])
  const initial = useMemo(() => defaultValues(fields, preset), [fields, preset])
  const groups = useMemo(() => groupFields(fields), [fields])
  const dependencies = useMemo(() => dependencyKeys(fields), [fields])

  const { register, handleSubmit, watch, setValue, getValues, reset, formState } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: initial,
    })

  // Switching model swaps the whole descriptor set: keeping the previous values would carry a
  // `guidance` from one model into another that never declared it.
  useEffect(() => reset(initial), [initial, reset])

  // Subscribed, not rendered: `watch(callback)` reports every edit without making this component
  // a listener of its own form. The body is built the same way submitting builds it, so what is
  // priced is what would be sent.
  useEffect(() => {
    if (!onValuesChange) return

    onValuesChange(buildBody(fields, getValues()))
    const subscription = watch(current => onValuesChange(buildBody(fields, current)))
    return () => subscription.unsubscribe()
  }, [fields, getValues, onValuesChange, watch])

  // Watching the whole form would re-render every control on every keystroke. Only the keys
  // another field declares a dependency on can change what is on screen.
  const watched = dependencies.length > 0 ? watch(dependencies) : []
  const values: FormValues = Object.fromEntries(
    dependencies.map((key, index) => [key, watched[index]]),
  )

  if (fields.length === 0) {
    return <p className="text-muted p-2 text-xs">{t('generation.noParameter')}</p>
  }

  return (
    <form
      className="flex flex-col gap-3 p-2"
      onSubmit={event =>
        void handleSubmit(submitted => onSubmit?.(buildBody(fields, submitted)))(event)
      }
    >
      {groups.map(([group, groupedFields]) => (
        <fieldset key={group} className="m-0 flex flex-col gap-2 border-0 p-0">
          {group && (
            <legend className="text-muted p-0 text-[11px] tracking-wide uppercase">
              {say(group)}
            </legend>
          )}

          {visibleFields(groupedFields, values).map(field => (
            // The accessory sits outside the label rather than in it: it holds buttons, and a
            // control nested in a label steals the click meant for the field.
            <Fragment key={field.key}>
              <label className="flex flex-col gap-2 text-xs">
                <span className="text-muted">
                  {say(field.label)}
                  {field.required && <span aria-hidden> *</span>}
                </span>

                <Control
                  field={field}
                  registration={register(field.key, { valueAsNumber: isNumeric(field.kind) })}
                  initial={initial[field.key]}
                  onRoll={() => setValue(field.key, randomSeed())}
                />

                {field.help && <span className="text-muted text-[11px]">{say(field.help)}</span>}
                {formState.errors[field.key] && (
                  <span role="alert" className="text-danger text-[11px]">
                    {t('errors.invalidValue')}
                  </span>
                )}
              </label>

              {accessory?.(field, {
                read: () => getValues(field.key),
                write: value => setValue(field.key, value),
                readAll: () => getValues(),
              })}
            </Fragment>
          ))}
        </fieldset>
      ))}

      {submitLabel !== undefined && (
        <Button type="submit" variant="primary" disabled={busy}>
          {submitLabel}
          {/* Spaced here rather than by a gap on the button: every tool button in the studio is
              built on the same base, and most of them are an icon beside a word. */}
          {submitNote && <span className="ml-1.5 text-[11px] opacity-70">{submitNote}</span>}
        </Button>
      )}
    </form>
  )
}
