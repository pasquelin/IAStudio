import { createContext } from 'react'

/**
 * What a band offers the rows inside it, so a drag can reach past what is on screen.
 *
 * Published by the column because the column is the only one that knows its own box AND the
 * height of the whole stack: a row knows neither, and the store keeps no viewport size. Here
 * rather than in either of them — the column provides it, a grip consumes it, and importing it
 * back from the column would close a cycle.
 */
export type BandScroll = {
  /**
   * Opens the band's own gesture, and closes it with `null` — it only travels while a row is held.
   *
   * The pointer comes with it, both halves of it: the band answers to THAT pointer and no other,
   * as the grip does, and it starts from where the press landed rather than waiting for a first
   * move that a hand holding still never makes.
   */
  onDrag: (from: { pointerId: number; y: number } | null) => void
  /** Read at every step of a drag: an auto-scroll moves the stack under a pointer that is still. */
  scrollTop: () => number
}

export const BandScrollContext = createContext<BandScroll | null>(null)
