import { useEffect } from 'react'

/**
 * What the three virtualized surfaces of the studio agree on.
 *
 * `Collection`, `Carousel` and `Masonry` had — or were about to have — the same two numbers
 * three times over, one of them under a comment saying so. A gutter that drifts between a grid
 * and a rail is visible on any screen that shows both, and the home shows both.
 */

/** Between two cards, whichever direction they are laid out in. */
export const GAP = 8

/**
 * How many rows from the bottom the next page is asked for — before the user sees the end.
 *
 * Counted in rows and not in pixels because that is what survives a change of card size: three
 * rows of tall cards and three rows of short ones are both "enough warning to fetch".
 */
export const PREFETCH_ROWS = 3

export type Columns = {
  columns: number
  /**
   * What one column actually measures. Cards fill their column, so this — not the width that
   * was aimed for — is what a cell is sized and estimated from.
   */
  columnWidth: number
}

/**
 * How many cards of a target width fit across `width`, and what one column then measures.
 *
 * At least one column: a surface narrower than a single card still has to draw it, and a count
 * of zero divides the width by nothing.
 */
export function columnsIn(width: number, aim: number): Columns {
  const columns = Math.max(1, Math.floor((width + GAP) / (Math.max(aim, 1) + GAP)))
  return { columns, columnWidth: (width - (columns - 1) * GAP) / columns }
}

export type ReachEnd = {
  /** The furthest index currently mounted — rows for a list, items for a masonry. */
  last: number
  /** How many there are in that same unit. */
  count: number
  /** How much warning the caller wants, in that same unit. */
  ahead: number
}

/**
 * Calls back as the end of a virtualized surface nears, so the next page is asked for before
 * the reader sees the bottom.
 *
 * An empty surface is NOT the end of one: asking for more with nothing on screen loops until the
 * source runs dry, and only the caller knows whether an empty answer is worth another request.
 *
 * `Collection` and `Masonry` had this rule twice, down to the comment. The unit differs — rows
 * there, items here — which is why it is the caller that says what it counts in.
 */
export function useReachEnd({ last, count, ahead }: ReachEnd, onReachEnd?: () => void): void {
  const nearEnd = count > 0 && last >= count - ahead

  useEffect(() => {
    if (nearEnd) onReachEnd?.()
  }, [nearEnd, count, onReachEnd])
}

/**
 * Re-measures a virtualizer when what its estimator reads has changed.
 *
 * The virtualizer memoizes on `count` and friends, never on the estimator itself: without this,
 * a resize leaves every cell at the height the previous width gave it. `key` is whatever the
 * estimate is computed from, flattened — a scalar, so that a float drifting by a fraction of a
 * pixel can be rounded out of it before it costs N estimates a frame.
 */
export function useRemeasure(virtualizer: { measure: () => void }, key: string | number): void {
  useEffect(() => virtualizer.measure(), [virtualizer, key])
}
