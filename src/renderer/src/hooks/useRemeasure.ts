import { useEffect } from 'react'

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
