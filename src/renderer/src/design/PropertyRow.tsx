import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

export type PropertyRowProps = {
  label: string
  /** A value to read, or a control to change it. */
  children: ReactNode
  /** Lets a long value — a prompt, a path — wrap under its label instead of truncating. */
  stacked?: boolean
}

/**
 * One property of whatever is selected: a label on the left, its value or its control on the
 * right. Written once so the inspector's four faces share a gauge and an alignment rather than
 * each inventing a two-column layout.
 */
export function PropertyRow({ label, children, stacked = false }: PropertyRowProps) {
  return (
    <div
      className={cn(
        'px-2 py-1 text-[11px]',
        stacked ? 'flex flex-col gap-2' : 'flex min-h-(--sc-control) items-center gap-2',
      )}
    >
      <span className={cn('text-muted shrink-0', stacked ? '' : 'w-20 truncate')}>{label}</span>
      <div className={cn('text-text min-w-0', stacked ? '' : 'flex-1 truncate text-right')}>
        {children}
      </div>
    </div>
  )
}
