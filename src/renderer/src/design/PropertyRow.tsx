import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { FIELD_LABEL, FIELD_ROW } from './styles'

export type PropertyRowProps = {
  label: string
  /** A value to read, or a control to change it. */
  children: ReactNode
  /** Lets a long value — a prompt, a path — wrap under its label instead of truncating. */
  stacked?: boolean
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
export function PropertyRow({ label, children, stacked = false }: PropertyRowProps) {
  return (
    <div className={cn(stacked ? 'text-tiny flex min-w-0 flex-col gap-2' : FIELD_ROW)}>
      {/* Titled because the column truncates: `Repeat preview` fits eighty pixels and
          `Aperçu de la répétition` does not, so the label was readable in one language only. */}
      <span title={label} className={stacked ? 'text-muted shrink-0' : FIELD_LABEL}>
        {label}
      </span>
      <div className={cn('text-text min-w-0', stacked ? '' : 'flex-1 truncate text-right')}>
        {children}
      </div>
    </div>
  )
}
