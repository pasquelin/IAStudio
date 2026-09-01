import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

export type PanelHeaderProps = {
  title: string
  children?: ReactNode
  /** Lets the actions take the free width rather than hug the close button — for a panel whose
   * row is wide and mostly empty, and which carries a whole bar there rather than a button or
   * two. Such actions own their end of the row: nothing pins them to the close button any more. */
  fillActions?: boolean
  /** Pinned past the actions: whatever crowds the row, the way out of the panel stays reachable. */
  trailing?: ReactNode
}

export function PanelHeader({ title, children, fillActions, trailing }: PanelHeaderProps) {
  return (
    <header className="flex h-(--sc-header) shrink-0 items-center gap-2 pr-1.5 pl-3">
      {/* `flex-1` is `flex: 1 1 0%`, and a basis of zero weighs nothing when the row runs short:
          all of it would be taken from the title, which `truncate` lets crush to invisible. The
          name of the panel is not what a crowded row should spend first. */}
      <span className={cn('text-text text-body truncate font-semibold', fillActions && 'shrink-0')}>
        {title}
      </span>
      {/* The half that gives ground: a panel crowding its row loses its own actions first, and
          never the close button, which would leave the panel with no way out. */}
      <span
        className={cn(
          'flex min-w-0 items-center gap-0.5 overflow-hidden',
          fillActions ? 'flex-1' : 'ml-auto',
        )}
      >
        {children}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">{trailing}</span>
    </header>
  )
}
