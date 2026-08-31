import type { RefObject } from 'react'
import { cn } from '@/helpers/cn'

export type GhostTextProps = {
  /** What the hand has written, painted invisible so the tail starts where the caret is. */
  typed: string
  /** What is left of the sentence, in grey ahead of the caret. Empty while nothing completes. */
  tail: string
  /** The host field's own type and gutters. */
  metrics: string
  /** 🛑 Required: a mirror the host cannot scroll draws its tail against the wrong line. */
  ref: RefObject<HTMLDivElement | null>
  className?: string
}

/** 🛑 The tail never enters the field's value: put there it is what the form submits. */
export function GhostText({ typed, tail, metrics, ref, className }: GhostTextProps) {
  return (
    <div
      ref={ref}
      // The field beneath already carries these words; a mirror read on top says them twice.
      aria-hidden
      className={cn(
        metrics,
        'pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap',
        className,
      )}
    >
      <span className="invisible">{typed}</span>
      <span className="text-muted">{tail}</span>
    </div>
  )
}
