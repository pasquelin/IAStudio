import type { ReactNode } from 'react'

export type PanelHeaderProps = {
  title: string
  children?: ReactNode
  /** Pinned past the actions: whatever crowds the row, the way out of the panel stays reachable. */
  trailing?: ReactNode
}

export function PanelHeader({ title, children, trailing }: PanelHeaderProps) {
  return (
    <header className="flex h-(--sc-header) shrink-0 items-center gap-1 pr-1.5 pl-3">
      <span className="text-text truncate text-[13px] font-semibold">{title}</span>
      {/* The half that gives ground: a panel crowding its row loses its own actions first, and
          never the close button, which would leave the panel with no way out. */}
      <span className="ml-auto flex min-w-0 items-center gap-0.5 overflow-hidden">{children}</span>
      <span className="flex shrink-0 items-center gap-0.5">{trailing}</span>
    </header>
  )
}
