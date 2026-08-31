import { cn } from '@/helpers/cn'
import { fieldHandle } from './scHandle'
import type { ReactNode } from 'react'
import { PropertyLine } from './PropertyLine'
import { ResetButton } from './ResetButton'
import { COLOR_READOUT, type GestureProps, type FieldHandle, type FieldReset } from './styles'

export type ColorFieldProps = GestureProps &
  FieldHandle &
  FieldReset & {
    label: string
    /** Hexadecimal, `#rrggbb` — what the OS picker speaks and what a descriptor stores. */
    value: string
    onChange: (value: string) => void
    /** Buttons for the row's end column, drawn before the reset — a padlock, say. */
    actions?: ReactNode
  }

/** A colour swatch that opens the OS picker — the input itself, which already draws its value. */
export function ColorField({
  label,
  value,
  onChange,
  scId,
  onReset,
  actions,
  onGestureStart,
  onGestureEnd,
}: ColorFieldProps) {
  return (
    <PropertyLine
      label={label}
      root="label"
      actions={
        <>
          {actions}
          <ResetButton onReset={onReset} />
        </>
      }
    >
      <input
        type="color"
        data-sc={scId && fieldHandle(scId)}
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
      <span aria-hidden className={COLOR_READOUT}>
        {value}
      </span>
    </PropertyLine>
  )
}
