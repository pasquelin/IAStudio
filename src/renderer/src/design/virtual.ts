/**
 * What the three virtualized surfaces of the studio agree on.
 *
 * `Collection`, `Carousel` and `Masonry` had — or were about to have — the same two numbers
 * three times over, one of them under a comment saying so. A gutter that drifts between a grid
 * and a rail is visible on any screen that shows both, and the home shows both.
 *
 * The hooks that read these live under `hooks/` — `useReachEnd`, `useRemeasure`, `useRowHeight`.
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
