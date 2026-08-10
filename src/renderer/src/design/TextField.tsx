import { cn } from '@/helpers/cn'
import { FIELD, FIELD_LABEL, FIELD_ROW, type GestureProps } from './styles'

export type TextFieldProps = GestureProps & {
  label: string
  value: string
  onChange: (value: string) => void
  /**
   * Tooltip attributes from the host's own factory, already resolved — `HINT_LEFT` in the
   * inspector. For a field whose label says WHAT it is and whose contents need saying HOW: a CEL
   * expression naming its wires is the case that asked for it.
   */
  hint?: Record<string, string>
}

/**
 * A line of text in a property row — a node's name, or any descriptor value no table describes.
 * A field the inspector cannot type is still one the user must see and edit.
 */
export function TextField({
  label,
  value,
  onChange,
  hint,
  onGestureStart,
  onGestureEnd,
}: TextFieldProps) {
  return (
    <label className={FIELD_ROW}>
      <span title={label} className={FIELD_LABEL}>
        {label}
      </span>

      <input
        type="text"
        value={value}
        onChange={event => onChange(event.target.value)}
        // One entry per session at the field, not one per keystroke.
        onFocus={() => onGestureStart?.()}
        onBlur={() => onGestureEnd?.()}
        className={cn(FIELD, 'min-w-0 flex-1 text-[11px]')}
        {...hint}
      />
    </label>
  )
}
