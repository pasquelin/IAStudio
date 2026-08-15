import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { HINT_BOTTOM } from '@/helpers/tooltip'

/** The one table the window draws — models, tallies and the log all wear it. */
export function UsageTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-base-content/70">
        <tr className="border-base-300 border-b text-left">{head}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

/** Numbers align right so their digits line up; everything else reads from the left. */
/**
 * `hint` is for a column whose figures need a word the header has no room for — the frame a time
 * is read in, say. Already-translated text, like every tooltip factory takes, and `HintFactory`
 * rather than `TooltipFactory` because the header's own name is on screen: an `aria-label` here
 * would replace a visible name (WCAG 2.5.3).
 */
export function HeadCell({
  label,
  numeric = false,
  hint,
}: {
  label: string
  numeric?: boolean
  hint?: string
}) {
  return (
    <th
      className={cn('py-1.5 font-medium', numeric && 'text-right')}
      {...(hint === undefined ? {} : HINT_BOTTOM(hint))}
    >
      {label}
    </th>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="border-base-300 border-b last:border-b-0">{children}</tr>
}
