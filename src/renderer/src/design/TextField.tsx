import { cn } from '@/helpers/cn'
import { FIELD } from './styles'

export type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  onGestureStart?: () => void
  onGestureEnd?: () => void
}

/**
 * A line of text in a property row — a node's name, or any value a descriptor carries that no
 * table describes. The fallback matters: a field the inspector cannot type is still a field the
 * user must be able to see and edit, never one the panel quietly drops.
 */
export function TextField({
  label,
  value,
  onChange,
  onGestureStart,
  onGestureEnd,
}: TextFieldProps) {
  return (
    <label className="flex min-w-0 items-center gap-1 text-[11px]">
      <span className="text-muted w-16 shrink-0 truncate">{label}</span>

      <input
        type="text"
        value={value}
        onChange={event => onChange(event.target.value)}
        // One entry per session at the field, not one per keystroke.
        onFocus={() => onGestureStart?.()}
        onBlur={() => onGestureEnd?.()}
        className={cn(FIELD, 'min-w-0 flex-1 text-[11px]')}
      />
    </label>
  )
}
