import { useToken } from './useToken'

/**
 * A `--sc-*` gauge in pixels, for the code that needs the number CSS is already applying.
 *
 * An estimator takes a number while the row it estimates is sized by a class, and the two agree
 * only if the number is read back from the gauge: `Tree` estimated a constant 28 against a
 * compact row of 24, four pixels a row, compounding down the list.
 *
 * `fallback` covers a gauge the stylesheet has not declared — under jsdom every one of them
 * reads back empty — and follows `tokenAsHex` rather than guessing a value of its own.
 */
export function useGauge(name: string, fallback: number): number {
  const pixels = Number.parseFloat(useToken(name))
  return Number.isFinite(pixels) ? pixels : fallback
}
