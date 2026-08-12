import { LIST_ROW_HEIGHT, STACKED_ROW_HEIGHT } from '@/design/styles'
import { useGauge } from './useGauge'

/**
 * How tall a list row is — a SHAPE by preference, a number only for what no gauge describes.
 *
 * A shape is resolved by reading the gauge the stylesheet already applies. Callers used to pass
 * `LIST_ROW_HEIGHT` themselves, which was right at one density and left four pixels of dead
 * space at the other.
 */
export type RowHeight = 'control' | 'stacked' | number

/**
 * The pixels a row shape measures, read back from the gauge that sizes it.
 *
 * Shared by the two virtualized lists rather than written in each, and the sharing is what the
 * explorer was missing: `Tree` sized every row on `--sc-control` while `EntryRow` stacks a name
 * over a subtitle for any document that is open. The stylesheet writes what that costs beside
 * the gauge itself — two steps of `leading-tight` text are 27.5px, which fills a 28px row edge
 * to edge and overflows a compact one, where `--sc-control` is 24px. The name and the « open »
 * line then spilled over the row below, and the tint that marks the row stopped where the text
 * did not.
 */
export function useRowHeight(shape: RowHeight): number {
  // Both read unconditionally: a hook cannot sit behind a branch.
  const control = useGauge('--sc-control', LIST_ROW_HEIGHT)
  const stacked = useGauge('--sc-row-stacked', STACKED_ROW_HEIGHT)

  if (typeof shape === 'number') return shape
  return shape === 'stacked' ? stacked : control
}
