/**
 * How far a band travels while something is held against its edge.
 *
 * A stack taller than the panel puts its last rows past the bottom of the WINDOW — measured on
 * 15 August 2026: five tracks of 56 px in a panel docked at the foot of the screen reach y=1308
 * for an inner height of 1290. Those rows cannot be dragged to, and no arithmetic in the gesture
 * fixes that: the band has to come to the pointer.
 */

/** How near an edge the pointer has to come before the band starts moving under it. */
export const EDGE_MARGIN = 28

/** The fastest a band travels while held against its edge, in pixels a second. */
export const EDGE_SPEED = 900

/** The top and bottom of what a band actually shows, in client coordinates. */
export type BandEdges = { top: number; bottom: number }

/**
 * How far the band should travel over `seconds`, with the pointer at `y` — negative towards the
 * start of the stack, zero anywhere but the two margins.
 *
 * The rate ramps across the margin rather than switching on: a step change makes the stack bolt
 * the instant the pointer grazes the edge, and the row one is placing overshoots by a rank
 * before the hand can answer. Past the edge it holds at full speed — the pointer can be far
 * outside the window, and speed proportional to how far out would be unusable.
 *
 * Above wins over below when a band is too short to hold both margins: a stack one cannot see
 * the top of is the worse of the two places to be stuck.
 */
export function edgeScroll(y: number, band: BandEdges, seconds: number): number {
  const above = band.top + EDGE_MARGIN - y
  const below = y - (band.bottom - EDGE_MARGIN)

  if (above > 0) return -rate(above) * seconds
  if (below > 0) return rate(below) * seconds
  return 0
}

function rate(depth: number): number {
  return Math.min(depth / EDGE_MARGIN, 1) * EDGE_SPEED
}
