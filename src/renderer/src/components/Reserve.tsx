import { cn } from '@/helpers/cn'

export type ReserveProps = {
  /**
   * The room ONE block keeps, as a class and never as a number: `76` in JavaScript was right at
   * font scale 1 and short by a third at 1.4 — the very jump a stand-in exists to prevent.
   */
  height: string
  /** How many, for a band waiting on a LIST rather than on a single block. */
  count?: number
  /** What the reserved room is dressed in, where the wait is meant to be seen. */
  className?: string
}

/**
 * The room a surface keeps while it does not yet know what it holds.
 *
 * `aria-hidden`: this announces nothing, it only stops the page jumping when the content lands. A
 * sentence saying « loading » is the other thing, and it is `WindowNote`.
 */
export function Reserve({ height, count = 1, className }: ReserveProps) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: count }, (_unused, rank) => (
        <span key={rank} className={cn('block', height, className)} />
      ))}
    </div>
  )
}
