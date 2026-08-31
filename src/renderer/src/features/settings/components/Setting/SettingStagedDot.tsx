import { cn } from '@/helpers/cn'

export type SettingStagedDotProps = {
  /** Changed and not yet applied. Off keeps the room rather than the mark, so nothing shifts. */
  staged: boolean
  /** What it says when it is on, already translated. Absent on a line with nothing to stage. */
  label?: string
  /** The ink, where `bg-primary` would vanish — a column entry is painted in that very colour. */
  className?: string
}

/**
 * The dot that marks a setting changed and waiting for Apply. Hidden rather than unmounted, so a
 * touched value does not shift its row; the ink stays at the call, a column entry being painted in
 * the very colour the dot would otherwise use.
 */
export function SettingStagedDot({ staged, label, className }: SettingStagedDotProps) {
  return (
    <span
      aria-hidden={!staged}
      {...(staged && label !== undefined && { title: label })}
      className={cn('bg-primary size-1.5 shrink-0 rounded-full', !staged && 'invisible', className)}
    />
  )
}
