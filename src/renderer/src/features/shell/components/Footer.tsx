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
 *
 * The rail's inset, not the gutter — the two only coincide in comfort. No height of its own
 * either: a fixed one centred the line and gave its air away to whatever the density was not.
 */
export function Footer({ left, right }: FooterProps) {
  return (
    <footer className="text-muted text-tiny flex shrink-0 items-center gap-3 px-(--sc-rail-inset) py-(--sc-gutter)">
      <span className="truncate">{left}</span>
      <span className="ml-auto flex shrink-0 items-center gap-3">{right}</span>
    </footer>
  )
}
