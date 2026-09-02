// SPDX-License-Identifier: MIT

/**
 * 🛑 Spelt here rather than taken from `@shared/numeric`, which is the same function: this tree
 * is MIT and the shared one is not, and `main/game-imports.test.ts` holds the frontier.
 */
export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

export const DEGREES = Math.PI / 180

/** A hair over a full turn: past a few million radians a float stops resolving a degree. */
export const FULL_TURN = Math.PI * 2
