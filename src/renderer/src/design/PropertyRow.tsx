import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { FieldActions } from './FieldActions'
import { PropertyLabel } from './PropertyLabel'
import { FIELD_ROW } from './styles'

/**
 * How a value that does not fit its column is given room.
 *
 * `inline` truncates, which is right for a number or a name. `stacked` drops the value onto its
 * own line under the label — a prompt, a paragraph. `wrap` keeps the two columns and lets the
 * value run onto a second line, for a value with no head and no tail: a hash.
 *
 * `path` is the same column, clipped at its HEAD — `Images/Croquis/etude.jpg` broken mid-word
 * costs a line and shows nothing the far end did not already say, the file's own name being
 * what a reader looks for. The same reading `Row` gives a path with `clip="start"`.
 */
export type PropertyShape = 'inline' | 'stacked' | 'wrap' | 'path'

export type PropertyRowProps = {
  label: string
  /** A value to read, or a control to change it. */
  children: ReactNode
  shape?: PropertyShape
  /** What the line ends with — a button that acts on the value, never one that replaces it. */
  actions?: ReactNode
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
export function PropertyRow({ label, children, shape = 'inline', actions }: PropertyRowProps) {
  return (
    <div
      className={cn(
        shape === 'stacked' ? 'text-tiny flex min-w-0 flex-col gap-2' : FIELD_ROW,
        // The label rides the FIRST line of a value that takes two, as it would in any
        // information panel; centred, it floated beside the middle of a wrapped path.
        shape === 'wrap' && 'items-start',
      )}
    >
      {/* Stacked, the value sits UNDER the name rather than beside it — so there is no column,
          and therefore no rule and no fixed gauge to hold it to. */}
      {shape === 'stacked' ? (
        <span title={label} className="text-muted shrink-0">
          {label}
        </span>
      ) : (
        <PropertyLabel label={label} />
      )}
      <div
        className={cn(
          'text-text min-w-0',
          // Left like a field's own control, so a value read and a value edited share one column:
          // « Rôle » used to begin where « Taille » ended.
          shape !== 'stacked' && 'flex-1',
          shape === 'inline' && 'truncate',
          shape === 'path' && 'truncate-start',
          // `break-all`: a path and a hash hold no space to break at, so a wrap with nothing to
          // wrap ON runs off the edge instead.
          shape === 'wrap' && 'break-all',
        )}
      >
        {children}
      </div>

      {/* Not when stacked: there is no column there, so no end column to hold either. */}
      {shape !== 'stacked' && <FieldActions>{actions}</FieldActions>}
    </div>
  )
}
