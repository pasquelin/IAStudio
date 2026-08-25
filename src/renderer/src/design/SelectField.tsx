import { mdiChevronDown } from '@mdi/js'
import { useId, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { FieldActions } from './FieldActions'
import { FormField } from './FormField'
import { PropertyLabel } from './PropertyLabel'
import { fieldHandle } from './scHandle'
import { CONTROL, FIELD, FIELD_ROW, NATIVE_SELECT } from './styles'
import { UiIcon } from './UiIcon'

export type SelectOption<V extends string> = {
  value: V
  label: string
  disabled?: boolean
  /** The heading this option stands under. Options sharing one are drawn together, in order. */
  group?: string
}

export type SelectFieldProps<V extends string> = {
  label: string
  /** `null` is a value no option names — a world nobody's preset matches, a file with no domain. */
  value: V | null
  options: readonly SelectOption<V>[]
  onChange: (value: V) => void
  /**
   * What a value NO OPTION CARRIES reads as, on a row of its own that nobody may pick — `null`
   * included. Without it the browser falls back to the FIRST option, so a snap step the
   * preferences set between two of the offered ones reads as the smallest of them.
   */
  unnamedLabel?: string
  /**
   * `row` is the property line, `stacked` the form field with its name above. `inline` drops the
   * label column; `bar` drops it too and draws its own chevron, the native one being pinned to
   * the control's edge where no padding reaches it.
   */
  layout?: 'row' | 'stacked' | 'inline' | 'bar'
  /**
   * Tooltip attributes from the host's own factory, already resolved. `TIP_*` sets a name and is
   * for a select drawing no visible label; `HINT_*` adds to one and is for `row` (WCAG 2.5.3).
   */
  hint?: Record<string, string>
  /** Between the label and the select — the thumbnail of what a link field points at. */
  leading?: ReactNode
  /** Buttons that follow the select: adding a rail, browsing for an asset, clearing a slot. */
  actions?: ReactNode
  /** The handle the MCP steers this field by. Never a translated word — see `pilotable.test.ts`. */
  scId?: string
  /** Worn by the ROW, not the select: what a caller sizes or spans is the whole field. */
  className?: string
}

/** The row a `null` stands on: a `<select>` always shows one of its own entries. */
const UNNAMED = ''

type OptionRun<V extends string> = { group?: string; run: SelectOption<V>[] }

/** Runs of options by heading, in the order the caller listed them — never sorted or merged. */
function runsOf<V extends string>(options: readonly SelectOption<V>[]): OptionRun<V>[] {
  // The twenty callers that group nothing walk out with the array they came in with.
  if (options.every(one => one.group === undefined)) return [{ run: [...options] }]

  const runs: OptionRun<V>[] = []
  for (const option of options) {
    const last = runs[runs.length - 1]
    if (last && last.group === option.group) last.run.push(option)
    else runs.push({ group: option.group, run: [option] })
  }

  return runs
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
  unnamedLabel,
  layout = 'row',
  hint,
  leading,
  actions,
  scId,
  className,
}: SelectFieldProps<V>) {
  // Bound by `htmlFor` rather than by wrapping, so a thumbnail can stand between the name and the
  // control: a label that WRAPS them would make pressing the picture open the list beside it.
  const id = useId()
  /**
   * Read off the OPTIONS rather than off `null` alone: a stored value can fall outside the list
   * without being absent — a snap step the preferences set between two of the offered ones.
   *
   * Only where the caller named it: a field that already carries an « empty » entry of its own
   * would otherwise get a SECOND `<option value="">`, and picking either became ambiguous.
   */
  const unnamed =
    unnamedLabel !== undefined && (value === null || !options.some(one => one.value === value))

  // A real `<label>` either way, since a select is what a label may safely bind: pressing the
  // word opens the list, which is the gesture anyone expects of it.
  const named = layout === 'row' || layout === 'stacked'

  const control = (
    <select
      id={id}
      // Only where no visible name is drawn, for the reason above.
      aria-label={named ? undefined : label}
      data-sc={scId && fieldHandle(scId)}
      value={unnamed ? UNNAMED : (value ?? UNNAMED)}
      onChange={event => {
        const picked = options.find(option => option.value === event.target.value)
        if (picked) onChange(picked.value)
      }}
      {...hint}
      className={cn(
        layout === 'bar'
          ? cn(CONTROL, 'w-full cursor-pointer appearance-none border-none pr-6 pl-2')
          : // `stacked` is a FORM field — its name above it, the control at full width — so it
            // wears what the fields around it wear. `NATIVE_SELECT` is the BAR language: no
            // border, wider corner, and it read as the one control of the generation panel that
            // had strayed in from a toolbar.
            layout === 'stacked'
            ? FIELD
            : NATIVE_SELECT,
        'min-w-0 flex-1',
        // The unset entry reads quieter than a value, which is how a filter bar shows at a
        // glance which of its facets are actually filtering.
        layout === 'bar' && !value && 'text-muted',
      )}
    >
      {/* Only while nothing names the value: an entry no one may pick would otherwise sit in
            every list, and `disabled` is what keeps it out of the answers while it shows. */}
      {unnamed && (
        <option value={UNNAMED} disabled>
          {unnamedLabel}
        </option>
      )}

      {runsOf(options).map(({ group, run }, index) => {
        const entries = run.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))

        return group === undefined ? (
          entries
        ) : (
          // Keyed by POSITION: two runs are free to share a heading, and two same-keyed
          // optgroups reconcile as undefined behaviour.
          <optgroup key={`${index}:${group}`} label={group}>
            {entries}
          </optgroup>
        )
      })}
    </select>
  )

  // The form field, its name above it and nothing in a column beside it. What flanks the control
  // still flanks it: a stacked field browses and clears like any other.
  if (layout === 'stacked') {
    return (
      <FormField label={label} htmlFor={id} className={className}>
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          {control}
          {/* Bare, as on the `bar` line below: a stacked field ends no property line, and the
              column `FieldActions` reserves was taken out of the control — the select stopped
              short of the fields under it. */}
          {actions}
        </div>
      </FormField>
    )
  }

  return (
    <div
      className={cn(layout === 'bar' ? 'relative flex min-w-0 items-center' : FIELD_ROW, className)}
    >
      {layout === 'row' && <PropertyLabel as="label" htmlFor={id} label={label} />}

      {leading}

      {control}

      {/* Only the closed control is restyled; the open list stays the platform's, which is the
          whole reason a `<select>` is used inside a panel too narrow for a menu of its own. */}
      {layout === 'bar' && (
        <UiIcon
          path={mdiChevronDown}
          size={12}
          className="text-muted pointer-events-none absolute right-2"
        />
      )}

      {/* A property line keeps its end room whether or not it acts; a bar or an inline select is
          not one, and would only be given a gap nothing ever fills. */}
      {layout === 'row' ? <FieldActions>{actions}</FieldActions> : actions}
    </div>
  )
}
