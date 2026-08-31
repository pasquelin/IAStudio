import type { ElementType, ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { FIELD_LABEL } from './styles'

export type PropertyLabelProps = {
  label: string
  /**
   * `label` for a control the label BINDS — a text field, a select. `span` where binding would
   * do harm: a bound label focuses what it names, so a `NumberField` wearing one would leave the
   * field in edit mode at the end of every drag.
   */
  as?: ElementType
  /** Passed through where the element is a `<label>`, which is the only case it means anything. */
  htmlFor?: string
  /** A chevron, where the row folds. Drawn before the word, inside the column. */
  leading?: ReactNode
  /**
   * Attributes already resolved, the way `hint` hands over tooltip ones — the scrub handlers a
   * `NumberField` puts on its name, the press and the `aria-expanded` a `VectorField` puts on its
   * fold. Untyped because what a column carries depends on what `as` made it.
   */
  gesture?: Record<string, unknown>
  /** For a name one DRAGS, which is not a name a reader steps onto. */
  hidden?: boolean
  className?: string
}

/**
 * The name of one property, in the column every property line shares.
 *
 * A COMPONENT rather than the class it wraps, since 2026-08-19, and that is what the two-column
 * reading needed: the column carries a fill and an edge now, so it has to stand the full height
 * of its row — and a box that stretches cannot also be the box that truncates. Eight fields were
 * each writing the span, the gauge and the `title` out by hand; the day the shape gained a second
 * element, that was eight places to change and eight chances to leave one behind.
 *
 * `title` is set here once, for all of them: the column truncates, and « Segments radiaux » read
 * as « Segments ra… » in every panel of the studio.
 */
export function PropertyLabel({
  label,
  as: Tag = 'span',
  htmlFor,
  leading,
  gesture,
  hidden,
  className,
}: PropertyLabelProps) {
  return (
    <Tag
      htmlFor={htmlFor}
      aria-hidden={hidden}
      {...gesture}
      title={label}
      className={cn(
        FIELD_LABEL,
        // Full height, so the column reads as a column rather than as a word floating in one.
        'flex items-center gap-1.5 self-stretch',
        className,
      )}
    >
      {leading}
      <span className="min-w-0 truncate">{label}</span>
    </Tag>
  )
}
