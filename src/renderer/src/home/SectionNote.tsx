import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

export type SectionNoteProps = {
  children: ReactNode
  /** For a note that stands in for a whole band of pictures, rather than sitting beside one. */
  standalone?: boolean
}

/**
 * The quiet line a band says something with when it has no pictures to show.
 *
 * Five bands had written the same paragraph — same colour, same size, same reset margin — and
 * were already a pixel apart on the padding. One more would have invented a sixth spacing.
 */
export function SectionNote({ children, standalone = false }: SectionNoteProps) {
  return (
    <p className={cn('text-muted m-0 text-xs leading-normal', standalone && 'py-6 text-center')}>
      {children}
    </p>
  )
}
