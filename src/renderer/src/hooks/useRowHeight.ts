import { FILLED_ROW_HEIGHT, LIST_ROW_HEIGHT, STACKED_ROW_HEIGHT } from '@/design/styles'
import { useGauge } from './useGauge'

/**
 * How tall a list row is — a SHAPE, never a number: the `number` arm let `Models` write 40px,
 * right at one density and wrong at the other, and no guard saw it. `Row` wears the matching
 * `min-h` for the same shape, so a list and the rows in it cannot disagree.
 *
 * `stacked` and `filled` hold the same two steps of text and part on what is BEHIND them: a row
 * painted edge to edge loses to its own fill the room a bare row keeps.
 */
export type RowHeight = 'control' | 'stacked' | 'filled'

/**
 * The pixels a row shape measures, read back from the gauge that sizes it.
 *
 * A shape rather than a number, because a constant is only right at one density.
 *
 * The shapes past `control` belong to `Collection` alone since 2026-08-14: `Tree` asks for a
 * control and cannot be told otherwise — the explorer used to ask for `stacked`, which measured a
 * whole panel for a second line one row in thirty carried, and a tree is a list of NAMES. What
 * each shape costs is written where the gauges are declared, in `index.css`.
 */
export function useRowHeight(shape: RowHeight): number {
  // A table rather than a chain, and every gauge read unconditionally: a hook cannot sit behind a
  // branch, so the next shape adds a line here and nothing else.
  const heights = {
    control: useGauge('--sc-control', LIST_ROW_HEIGHT),
    stacked: useGauge('--sc-row-stacked', STACKED_ROW_HEIGHT),
    filled: useGauge('--sc-row-filled', FILLED_ROW_HEIGHT),
  }

  return heights[shape]
}
