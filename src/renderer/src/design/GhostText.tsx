import type { Ref } from 'react'
import { cn } from '@/helpers/cn'

export type GhostTextProps = {
  /** What the hand has written, painted invisible so the tail starts where the caret is. */
  typed: string
  /** What is left of the sentence, in grey ahead of the caret. */
  tail: string
  /** The host field's own type and gutters — read from one place, or the tail lands a character off. */
  className: string
  ref?: Ref<HTMLDivElement>
}

/**
 * The grey rest of a sentence, painted behind a field that cannot paint text of its own.
 *
 * 🛑 Never in the field's value: put there the tail is what the form submits and what a store
 * holds. The host stays the only owner of what was typed, and of the key that takes the rest.
 */
export function GhostText({ typed, tail, className, ref }: GhostTextProps) {
  return (
    <div
      ref={ref}
      // The field beneath already carries these words; a mirror read on top says them twice.
      aria-hidden
      className={cn(
        className,
        'pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap',
      )}
    >
      <span className="invisible">{typed}</span>
      <span className="text-muted">{tail}</span>
    </div>
  )
}
