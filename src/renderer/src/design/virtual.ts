import { useGauge } from '@/hooks/useGauge'
import { LIST_ROW_HEIGHT, STACKED_ROW_HEIGHT } from './styles'
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

/**
 * Calls back as the end of a virtualized surface nears, so the next page is asked for before
 * the reader sees the bottom.
 *
 * An empty surface is NOT the end of one: asking for more with nothing on screen loops until the
 * source runs dry, and only the caller knows whether an empty answer is worth another request.
 *
 * `Collection` and `Masonry` had this rule twice, down to the comment. The unit differs — rows
 * there, items here — so the caller states it, and states it by name: three bare numbers swap
 * silently, and the swap would show up as a paging bug rather than as a type error.
 */
export function useReachEnd(
  { last, count, ahead }: { last: number; count: number; ahead: number },
  onReachEnd?: () => void,
): void {
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

/** How tall a list row is — a SHAPE by preference, a number only for what no gauge describes. */
export type RowHeight = 'control' | 'stacked' | number

/**
 * The pixels a row shape measures, read back from the gauge that sizes it.
 *
 * A shape rather than a number, because a constant is only right at one density. Shared by the
 * two virtualized surfaces rather than written in each, which is what the explorer was missing:
 * `Tree` sized every row on `--sc-control` while its rows stack a name over a subtitle for a
 * document that is open. What that costs is written where the gauge is declared, in `index.css`
 * beside `--sc-row-stacked`.
 */
export function useRowHeight(shape: RowHeight): number {
  // Both read unconditionally: a hook cannot sit behind a branch.
  const control = useGauge('--sc-control', LIST_ROW_HEIGHT)
  const stacked = useGauge('--sc-row-stacked', STACKED_ROW_HEIGHT)

  if (typeof shape === 'number') return shape
  return shape === 'stacked' ? stacked : control
}
