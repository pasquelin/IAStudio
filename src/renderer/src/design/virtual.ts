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
