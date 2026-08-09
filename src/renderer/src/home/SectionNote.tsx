import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

export type SectionNoteProps = {
  children: ReactNode
  /** Centred where the note stands in for the content itself, rather than sitting beside it. */
  centred?: boolean
  /** Room above and below, for a note that replaces a whole band of pictures. */
  spaced?: boolean
}

/**
 * The quiet line a band says something with when it has no pictures to show.
 *
 * Four bands had written the same paragraph — same colour, same size, same reset margin — and
 * were already a pixel apart on the padding. One more would have invented a sixth spacing.
 */
export function SectionNote({ children, centred = false, spaced = false }: SectionNoteProps) {
  return (
    <p
      className={cn(
        'text-muted m-0 text-[12px]',
        centred && 'text-center',
        spaced && 'py-6',
      )}
    >
      {children}
    </p>
  )
}
