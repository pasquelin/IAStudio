import { useToken } from './useToken'

/**
 * A `--sc-*` gauge in pixels, for the code that needs the number CSS is already applying.
 *
 * An estimator takes a number while the row it estimates is sized by a class; a constant is then
 * only right at one density, and the gap shows as dead space between rows.
 *
 * **Pixels, strictly positive, or `fallback`** — and the check is the point rather than a
 * formality. `parseFloat` reads `1.75rem` as `1.75`, which is the same height written another
 * way and a virtualizer estimating under two pixels a row: it mounts the whole list. Zero and
 * negatives break the window it computes. A gauge the stylesheet never declared reads back
 * empty, which is every gauge under jsdom.
 */
export function useGauge(name: string, fallback: number): number {
  const declared = useToken(name)
  const pixels = declared.endsWith('px') ? Number.parseFloat(declared) : Number.NaN
  return pixels > 0 ? pixels : fallback
}
