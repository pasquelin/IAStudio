import { clampAtLeast } from '@shared/numeric'

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
 * How many cards of a target width fit across `width`, and what one column then measures. `max`
 * caps a surface that wants a fixed number across whatever room it has; `aim` is then the floor
 * under which it shows fewer.
 *
 * Whole pixels: a float changed with every pixel of a drag, so callers comparing one reading to
 * the next never matched and re-laid their cards out twice a frame.
 */
export function columnsIn(width: number, aim: number, max = Infinity): Columns {
  const fitting = Math.floor((width + GAP) / (Math.max(aim, 1) + GAP))
  const columns = clampAtLeast(fitting, 1, max)
  return { columns, columnWidth: Math.floor((width - (columns - 1) * GAP) / columns) }
}

export type VirtualFocus = {
  /** Where the cells are looked for — the surface's own scroll container. */
  scroller: HTMLElement | null | undefined
  /** Brings the virtual ROW holding a cell into view. The virtualizer's own method. */
  scrollToIndex: (row: number) => void
  /** How many cells there are, which is what an arrow walking past the end is held to. */
  count: number
  /** The attribute a cell carries its index in — one surface numbers cells, the other rows. */
  attribute: 'data-cell' | 'data-row'
  /** How many cells a virtual row holds. One for a list, which is why it defaults. */
  columns?: number
}

/**
 * Moves the focus to cell `index`, scrolling the row that holds it into view first — the roving
 * tab stop both `Collection` and `Tree` walk with the arrows.
 */
export function focusVirtualCell(
  index: number,
  { scroller, scrollToIndex, count, attribute, columns = 1 }: VirtualFocus,
): void {
  const bounded = clampAtLeast(index, 0, count - 1)
  scrollToIndex(Math.floor(bounded / columns))

  const focus = (): void => {
    scroller?.querySelector<HTMLElement>(`[${attribute}="${bounded}"]`)?.focus()
  }
  // Twice: the cell is already mounted in the common case, and only a scroll that revealed a new
  // row needs the frame the virtualizer takes to render it.
  focus()
  requestAnimationFrame(focus)
}
