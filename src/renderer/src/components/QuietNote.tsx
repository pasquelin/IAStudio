import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

export type QuietNoteProps = {
  children: ReactNode
  /** For a note that stands in for a whole shelf of pictures, rather than sitting beside one. */
  standalone?: boolean
}

/**
 * The quiet line a surface says something with when it has no pictures to show.
 *
 * Five bands had written the same paragraph — same colour, same size, same reset margin — and
 * were already a pixel apart on the padding. It moved out of `home/` when three panels of the
 * rails wanted the same line: the bands it was written for are two, and the paragraph is the
 * studio's, not the page's.
 */
export function QuietNote({ children, standalone = false }: QuietNoteProps) {
  return (
    <p className={cn('text-muted m-0 text-xs leading-normal', standalone && 'py-6 text-center')}>
      {children}
    </p>
  )
}
