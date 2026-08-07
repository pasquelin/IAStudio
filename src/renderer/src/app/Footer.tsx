import type { ReactNode } from 'react'

export type FooterProps = {
  /** Breadcrumb: project, current document. */
  left?: ReactNode
  /** Counters and indicators — connection, jobs, memory. */
  right?: ReactNode
}

/**
 * Status line, at the foot of the window. It spans the full width, below the rails: what it
 * shows applies to the whole application, not to a single panel.
 */
export function Footer({ left, right }: FooterProps) {
  return (
    <footer className="text-muted flex h-6 shrink-0 items-center gap-3 px-3 text-[11px]">
      <span className="truncate">{left}</span>
      <span className="ml-auto flex shrink-0 items-center gap-3">{right}</span>
    </footer>
  )
}
