import { useMemo } from 'react'
import type { Component, JsonValue } from '@shared/domain/component'
import { NumberField } from '@/design/NumberField'
import { TextField } from '@/design/TextField'
import { ToggleField } from '@/design/ToggleField'
import type { GestureProps } from '@/design/styles'
import { settingsOf } from '@game/runtime/componentFields'
import { scriptProps } from '@/engines/code/scriptProps'
import { useCode } from '@/stores/code'

export type ScriptPropsProps = {
  component: Component
  gesture: GestureProps
  /** Handed the WHOLE bag back: a component is written in one gesture, so undo takes one step. */
  onChange: (props: Record<string, JsonValue>) => void
}

/**
 * The settings a script declares, as rows of the inspector.
 *
 * 🛑 Read off the FILE rather than off the component: a script that gained a setting shows it the
 * moment it is saved, and one that lost it stops offering a row nothing reads. What the component
 * carries is the VALUE alone — the author's declaration is the source of the row.
 *
 * The label is the author's own word and is NOT translated: nothing in the studio names it.
 */
export function ScriptProps({ component, gesture, onChange }: ScriptPropsProps) {
  const script = typeof component.script === 'string' ? component.script : ''
  // 🛑 The SOURCE is selected, never the parse: a selector that allocates is re-run for ever,
  // and zustand answers a fresh array every render.
  const source = useCode(state => state.files[script]?.source ?? '')
  const declared = useMemo(() => (source === '' ? [] : scriptProps(source)), [source])

  if (declared.length === 0) return null

  // The same reading the sandbox is handed, so a row shows what a script will get.
  const settings = settingsOf(component, 'props')

  return (
    <>
      {declared.map(({ field, fallback }) => {
        const value = settings[field.key] ?? fallback
        const write = (one: JsonValue): void => onChange({ ...settings, [field.key]: one })
        const scId = `field:components.Script.props.${field.key}`

        if (field.kind === 'boolean') {
          return (
            <ToggleField
              key={field.key}
              label={field.key}
              value={value === true}
              scId={scId}
              onChange={write}
            />
          )
        }
        if (field.kind === 'number') {
          return (
            <NumberField
              key={field.key}
              label={field.key}
              value={typeof value === 'number' ? value : 0}
              scId={scId}
              onChange={write}
              {...gesture}
            />
          )
        }
        return (
          <TextField
            key={field.key}
            label={field.key}
            value={typeof value === 'string' ? value : ''}
            scId={scId}
            onChange={write}
          />
        )
      })}
    </>
  )
}
