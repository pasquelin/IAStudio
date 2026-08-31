import type { ReactNode } from 'react'
import { WINDOW_CAPTION } from './windowStyles'

export type WindowNoteProps = {
  /** Already translated, as every component of `design/` takes its words. */
  children: ReactNode
}

/**
 * The line a window that is NOT a dock says when it has nothing to show — empty, waiting, absent.
 *
 * Deliberately not `QuietNote`, which answers the same question for the docks: that one writes
 * `text-muted`, a name the studio's `@theme` declares and DaisyUI has never heard of. The same
 * split as `WindowChip` beside `Chip`, for the same reason.
 */
export function WindowNote({ children }: WindowNoteProps) {
  return <p className={WINDOW_CAPTION}>{children}</p>
}
