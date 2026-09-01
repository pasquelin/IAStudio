import { useTranslation } from 'react-i18next'
import type { ActionField } from '@shared/domain/assistantAction'
import type { JsonValue } from '@shared/domain/component'
import { NumberField } from '@/components/NumberField'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { ToggleField } from '@/components/ToggleField'
import type { GestureProps } from '@/components/styles'

export type ComponentFieldProps = {
  /** What the row SHOWS. Handed over rather than read off a component: a script's settings live
   * in a bag beside the declared fields, and the row is the same either way. */
  value: JsonValue | undefined
  /** Already translated — a script's own setting is named by its author, and nothing translates
   * a word somebody wrote in their file. */
  label: string
  field: ActionField
  onChange: (value: JsonValue) => void
  gesture: GestureProps
  scId: string
}

/**
 * One field of one component, drawn from the descriptor that declares it.
 *
 * **Controlled from the document, not from a form library.** `DynamicForm` renders the same
 * `ActionField` list, and it was the first idea — but it owns its values in react-hook-form and
 * merges them back on reset, so a ⌘Z would leave the panel showing what was just undone. The
 * inspector's own controls read the state on every render, which is what makes undo instant.
 *
 * A `kind` nothing here draws falls back to raw text rather than vanishing — the same rule the
 * generation forms follow, and for the same reason.
 */
export function ComponentField({
  value: held,
  label,
  field,
  onChange,
  gesture,
  scId,
}: ComponentFieldProps) {
  const { t } = useTranslation()

  if (field.kind === 'boolean') {
    return (
      <ToggleField
        label={label}
        value={held === true}
        scId={scId}
        onChange={value => onChange(value)}
      />
    )
  }

  if (field.kind === 'choice') {
    return (
      <SelectField
        label={label}
        value={typeof held === 'string' ? held : null}
        options={(field.options ?? []).map(option => ({
          value: option,
          label: t(`game.values.${option}`, option),
        }))}
        onChange={value => onChange(value)}
        // A value no option carries reads as the FIRST one otherwise, so the panel would show
        // `X` while the document held something else — and the next edit would save that reading.
        unnamedLabel={t('game.values.unknown')}
        scId={scId}
      />
    )
  }

  if (field.kind === 'number' || field.kind === 'integer') {
    return (
      <NumberField
        label={label}
        value={typeof held === 'number' ? held : 0}
        min={field.min}
        max={field.max}
        step={field.kind === 'integer' ? 1 : undefined}
        scId={scId}
        onChange={value => onChange(value)}
        {...gesture}
      />
    )
  }

  return (
    <TextField
      label={label}
      value={typeof held === 'string' ? held : ''}
      scId={scId}
      onChange={value => onChange(value)}
    />
  )
}
