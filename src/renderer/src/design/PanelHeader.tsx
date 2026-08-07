import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

export type PanelHeaderProps = {
  title: string
  children?: ReactNode
  /** Lets the actions take the free width rather than hug the close button — for a panel whose
   * row is wide and mostly empty, and which would rather carry its bar there than under. */
  stretchActions?: boolean
  /** Pinned past the actions: whatever crowds the row, the way out of the panel stays reachable. */
  trailing?: ReactNode
}

export function PanelHeader({ title, children, stretchActions, trailing }: PanelHeaderProps) {
  return (
    <header className="flex h-(--sc-header) shrink-0 items-center gap-1 pr-1.5 pl-3">
      <span className="text-text truncate text-[13px] font-semibold">{title}</span>
      {/* The half that gives ground: a panel crowding its row loses its own actions first, and
          never the close button, which would leave the panel with no way out. */}
      <span
        className={cn(
          'flex min-w-0 items-center gap-0.5 overflow-hidden',
          stretchActions ? 'flex-1' : 'ml-auto',
        )}
      >
        {children}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">{trailing}</span>
    </header>
  )
}
