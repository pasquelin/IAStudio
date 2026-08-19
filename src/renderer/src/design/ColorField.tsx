import { cn } from '@/helpers/cn'
import { FieldActions } from './FieldActions'
import { PropertyLabel } from './PropertyLabel'
import { ResetButton } from './ResetButton'
import { FIELD_ROW, ROW_ACTION_SPACER, type GestureProps } from './styles'

export type ColorFieldProps = GestureProps & {
  label: string
  /** Hexadecimal, `#rrggbb` — what the OS picker speaks and what a descriptor stores. */
  value: string
  onChange: (value: string) => void
  /** The handle the MCP steers this field by. Never a translated word. */
  scId?: string
  /** Puts the colour back where it started. Absent while it already stands there. */
  onReset?: () => void
}

/** A colour swatch that opens the OS picker — the input itself, which already draws its value. */
export function ColorField({
  label,
  value,
  onChange,
  scId,
  onReset,
  onGestureStart,
  onGestureEnd,
}: ColorFieldProps) {
  return (
    <label className={FIELD_ROW}>
      <PropertyLabel label={label} />

      <input
        type="color"
        data-sc={scId && `field:${scId}`}
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
        )}
      />

      {/* Hidden from the accessibility tree: the swatch already announces the colour it holds,
          and a second copy would end up inside the field's own name. */}
      <span
        aria-hidden
        className="text-muted text-mini min-w-0 flex-1 truncate font-mono uppercase"
      >
        {value}
      </span>

      <FieldActions>
        <span aria-hidden className={ROW_ACTION_SPACER} />
        <ResetButton onReset={onReset} />
      </FieldActions>
    </label>
  )
}
