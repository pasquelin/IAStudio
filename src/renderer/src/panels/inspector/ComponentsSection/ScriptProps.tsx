import { useMemo } from 'react'
import type { Component, JsonValue } from '@shared/domain/component'
import { isRecord } from '@shared/guards'
import type { GestureProps } from '@/design/styles'
import { scriptProps } from '@/engines/code/scriptProps'
import { useCode } from '@/stores/code'
import { ComponentField } from './ComponentField'

export type ScriptPropsProps = {
  component: Component
  gesture: GestureProps
  /** Handed the WHOLE bag back: a component is written in one gesture, so undo takes one step. */
  onChange: (props: Record<string, JsonValue>) => void
}

/** 🛑 The rows come from the FILE; the component carries only the value. */
export function ScriptProps({ component, gesture, onChange }: ScriptPropsProps) {
  const script = typeof component.script === 'string' ? component.script : ''
  // The SOURCE is selected, never the parse: a selector that allocates re-runs for ever.
  const source = useCode(state => state.files[script]?.source ?? '')
  const declared = useMemo(() => (source === '' ? [] : scriptProps(source)), [source])

  if (declared.length === 0) return null

  // Read as it stands, never filtered: rewriting a filtered bag would drop, in silence, whatever
  // a script or an import put there that this panel does not draw.
  const settings: Record<string, JsonValue> =
    isRecord(component.props) && !Array.isArray(component.props) ? component.props : {}

  return (
    <>
      {declared.map(({ field, fallback }) => (
        <ComponentField
          key={field.key}
          value={settings[field.key] ?? fallback}
          label={field.key}
          field={field}
          gesture={gesture}
          scId={`field:components.Script.props.${field.key}`}
          onChange={value => onChange({ ...settings, [field.key]: value })}
        />
      ))}
    </>
  )
}
