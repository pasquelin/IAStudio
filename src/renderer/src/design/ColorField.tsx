import { cn } from '@/helpers/cn'
import { FIELD_LABEL, FIELD_ROW, FOCUS_RING, type GestureProps } from './styles'

export type ColorFieldProps = GestureProps & {
  label: string
  /** Hexadecimal, `#rrggbb` — what the OS picker speaks and what a descriptor stores. */
  value: string
  onChange: (value: string) => void
}

/** A colour swatch that opens the OS picker — the input itself, which already draws its value. */
export function ColorField({
  label,
  value,
  onChange,
  onGestureStart,
  onGestureEnd,
}: ColorFieldProps) {
  return (
    <label className={FIELD_ROW}>
      <span title={label} className={FIELD_LABEL}>
        {label}
      </span>

      <input
        type="color"
        // Named here rather than by the label around it: that label also holds the hexadecimal,
        // and a swatch called "Colour #ff0000" is a swatch nobody can find.
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
        // The picker stays open and reports every colour the pointer passes over: the gesture
        // runs from the click that opened it to the focus leaving the swatch behind.
        onPointerDown={() => onGestureStart?.()}
        onBlur={() => onGestureEnd?.()}
        className={cn(
          'border-border h-(--sc-control) w-8 shrink-0 cursor-pointer',
          'rounded-(--radius-sc-sm) border bg-transparent p-0.5',
          FOCUS_RING,
        )}
      />

      {/* Hidden from the accessibility tree: the swatch already announces the colour it holds,
          and a second copy would end up inside the field's own name. */}
      <span
        aria-hidden
        className="text-muted min-w-0 flex-1 truncate font-mono text-[10px] uppercase"
      >
        {value}
      </span>
    </label>
  )
}
