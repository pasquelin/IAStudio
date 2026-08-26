import type { ReactNode } from 'react'
import { FieldActions } from './FieldActions'
import { PropertyLabel } from './PropertyLabel'
import { fieldHandle } from './scHandle'
import { CHECKBOX, FIELD_ROW } from './styles'
import { cn } from '@/helpers/cn'

export type ToggleFieldProps = {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  /** The handle the MCP steers this field by. Never a translated word. */
  scId?: string
  /** One more button for the row’s end column, drawn before the reset — a padlock, say. */
  action?: ReactNode
}

/**
 * A property that is on or off. It carries no gesture props: a checkbox changes once per
 * click, so there is no drag to coalesce into a single history entry.
 */
export function ToggleField({ label, value, onChange, scId, action }: ToggleFieldProps) {
  return (
    <label className={FIELD_ROW}>
      <PropertyLabel label={label} />

      {/* At the START of the control column like every other field, since 2026-08-19: pinned to
          the far end it was the one line of the panel that began nowhere the others did, and it
          held its name to a gauge that read « Projette une … ». */}
      <input
        type="checkbox"
        data-sc={scId && fieldHandle(scId)}
        checked={value}
        onChange={event => onChange(event.target.checked)}
        // `mr-auto` rather than a filler element: the box keeps its size and takes the column.
        className={cn(CHECKBOX, 'mr-auto size-4 shrink-0')}
      />

      <FieldActions>{action}</FieldActions>
    </label>
  )
}
