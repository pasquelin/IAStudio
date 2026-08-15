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
