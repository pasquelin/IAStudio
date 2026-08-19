import { mdiChevronDown } from '@mdi/js'
import { useId, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { CONTROL, FIELD_LABEL, FIELD_ROW, NATIVE_SELECT } from './styles'
import { UiIcon } from './UiIcon'

export type SelectOption<V extends string> = {
  value: V
  label: string
  disabled?: boolean
}

export type SelectFieldProps<V extends string> = {
  label: string
  value: V
  options: readonly SelectOption<V>[]
  onChange: (value: V) => void
  /**
   * `row` is the property line. `inline` drops the label column, for a bar. `bar` drops it too
   * and draws its own chevron — the browser pins the native one to the edge of the control, where
   * no padding reaches it, and a filter bar is read as a row of words rather than of fields.
   */
  layout?: 'row' | 'inline' | 'bar'
  /**
   * Tooltip attributes from the host's own factory, already resolved. `TIP_*` sets a name and is
   * for a select drawing no visible label; `HINT_*` adds to one and is for `row` (WCAG 2.5.3).
   */
  hint?: Record<string, string>
  disabled?: boolean
  /** Between the label and the select — the thumbnail of what a link field points at. */
  leading?: ReactNode
  /** Buttons that follow the select: adding a rail, browsing for an asset, clearing a slot. */
  actions?: ReactNode
  /** The handle the MCP steers this field by. Never a translated word — see `pilotable.test.ts`. */
  scId?: string
  /** Worn by the ROW, not the select: what a caller sizes or spans is the whole field. */
  className?: string
}

/**
 * One of a fixed set of values. Written once because a `<select>` hands back a STRING: every one
 * of the twenty-one sites that drew its own had to read the answer back into its union, and three
 * of them did it three different ways — a type guard, a `find`, a local `asBlendMode`.
 *
 * Reading it back from `options` is what makes this generic sound: a value no option answers to
 * is dropped rather than written into the document.
 */
export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  layout = 'row',
  hint,
  disabled,
  leading,
  actions,
  scId,
  className,
}: SelectFieldProps<V>) {
  // Bound by `htmlFor` rather than by wrapping, so a thumbnail can stand between the name and the
  // control: a label that WRAPS them would make pressing the picture open the list beside it.
  const id = useId()

  return (
    <div
      className={cn(layout === 'bar' ? 'relative flex min-w-0 items-center' : FIELD_ROW, className)}
    >
      {/* Titled because the column truncates, and it is this label that names the select — an
          `aria-label` over it would replace the visible name (WCAG 2.5.3). */}
      {layout === 'row' && (
        <label htmlFor={id} title={label} className={FIELD_LABEL}>
          {label}
        </label>
      )}

      {leading}

      <select
        id={id}
        // Only where no visible name is drawn, for the reason above.
        aria-label={layout === 'row' ? undefined : label}
        data-sc={scId && `field:${scId}`}
        value={value}
        disabled={disabled}
        onChange={event => {
          const picked = options.find(option => option.value === event.target.value)
          if (picked) onChange(picked.value)
        }}
        {...hint}
        className={cn(
          layout === 'bar'
            ? cn(CONTROL, 'w-full cursor-pointer appearance-none border-none pr-6 pl-2')
            : NATIVE_SELECT,
          'min-w-0 flex-1',
          // The unset entry reads quieter than a value, which is how a filter bar shows at a
          // glance which of its facets are actually filtering.
          layout === 'bar' && value === '' && 'text-muted',
        )}
      >
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Only the closed control is restyled; the open list stays the platform's, which is the
          whole reason a `<select>` is used inside a panel too narrow for a menu of its own. */}
      {layout === 'bar' && (
        <UiIcon
          path={mdiChevronDown}
          size={12}
          className="text-muted pointer-events-none absolute right-2"
        />
      )}

      {actions}
    </div>
  )
}
