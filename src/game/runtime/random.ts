// SPDX-License-Identifier: MIT

/**
 * A seeded generator, because `Math.random` makes a game unreproducible — and reproducibility is
 * what network prediction, a replay and a gameplay test all rest on. Removed from the sandbox
 * later for the same reason.
 */
export type Random = {
  /** In `[0, 1)`, like `Math.random` and with the same distribution. */
  next: () => number
  /** In `[0, bound)`, whole. Answers 0 for a bound that is not positive. */
  int: (bound: number) => number
  /** What has been drawn so far, so a world can be restarted where it was. */
  state: () => number
}

/**
 * Mulberry32: 32 bits of state, one multiply and three shifts a draw. Chosen for being exactly
 * reproducible across engines — its state is one integer, so a saved game or a network packet
 * carries it in four bytes.
 */
export function createRandom(seed: number): Random {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state)
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int: bound => (bound > 0 ? Math.floor(next() * bound) : 0),
    state: () => state,
  }
}
