import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { FIELD_LABEL, FIELD_ROW } from './styles'

/**
 * How a value that does not fit its column is given room.
 *
 * `inline` truncates, which is right for a number or a name. `stacked` drops the value onto its
 * own line under the label — a prompt, a paragraph. `wrap` keeps the two columns and lets the
 * value run onto a second line: a path and a hash are ONE value, and stacking them in a box
 * whose every other row is a pair reads as a label whose value went missing.
 */
export type PropertyShape = 'inline' | 'stacked' | 'wrap'

export type PropertyRowProps = {
  label: string
  /** A value to read, or a control to change it. */
  children: ReactNode
  shape?: PropertyShape
}

/**
 * One property of whatever is selected: a label on the left, its value or its control on the
 * right. Written once so the inspector's four faces share a gauge and an alignment rather than
 * each inventing a two-column layout.
 *
 * NO inset and no padding of its own, on either axis: the group holding the row is what insets
 * and what spaces its children. The fields beside it carry none either, so a row that added its
 * own started eight pixels further in than the control right under it and stood twice as far
 * from its neighbour.
 *
 * It wears `FIELD_ROW` and `FIELD_LABEL` — the very shapes `NumberField` and its family wear.
 * Those two constants already claimed to be shared with this file and were spelt out here by
 * hand; a group draws both families side by side, so one of them drifting is two label columns
 * in the same box.
 */
export function PropertyRow({ label, children, shape = 'inline' }: PropertyRowProps) {
  return (
    <div
      className={cn(
        shape === 'stacked' ? 'text-tiny flex min-w-0 flex-col gap-2' : FIELD_ROW,
        // The label rides the FIRST line of a value that takes two, as it would in any
        // information panel; centred, it floated beside the middle of a wrapped path.
        shape === 'wrap' && 'items-start',
      )}
    >
      {/* Titled because the column truncates: `Repeat preview` fits eighty pixels and
          `Aperçu de la répétition` does not, so the label was readable in one language only. */}
      <span title={label} className={shape === 'stacked' ? 'text-muted shrink-0' : FIELD_LABEL}>
        {label}
      </span>
      <div
        className={cn(
          'text-text min-w-0',
          shape === 'inline' && 'flex-1 truncate text-right',
          // `break-all`: a path and a hash hold no space to break at, so a wrap with nothing to
          // wrap ON runs off the edge instead.
          shape === 'wrap' && 'flex-1 text-right break-all',
        )}
      >
        {children}
      </div>
    </div>
  )
}
