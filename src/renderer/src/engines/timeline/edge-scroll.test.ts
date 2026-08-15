import { describe, expect, it } from 'vitest'
import { edgeScroll, EDGE_MARGIN, EDGE_SPEED } from './edge-scroll'

const BAND = { top: 100, bottom: 400 }
const SECOND = 1

describe('edgeScroll', () => {
  it('leaves a band alone while the pointer is anywhere but its margins', () => {
    expect(edgeScroll(250, BAND, SECOND)).toBe(0)
    expect(edgeScroll(BAND.top + EDGE_MARGIN, BAND, SECOND)).toBe(0)
    expect(edgeScroll(BAND.bottom - EDGE_MARGIN, BAND, SECOND)).toBe(0)
  })

  it('travels towards the end of the stack at the bottom, and towards its start at the top', () => {
    expect(edgeScroll(BAND.bottom, BAND, SECOND)).toBe(EDGE_SPEED)
    expect(edgeScroll(BAND.top, BAND, SECOND)).toBe(-EDGE_SPEED)
  })

  /**
   * A step change makes the stack bolt the instant the pointer grazes the edge, and the row one
   * is placing overshoots by a rank before the hand can answer.
   */
  it('ramps across the margin rather than switching on', () => {
    const halfway = edgeScroll(BAND.bottom - EDGE_MARGIN / 2, BAND, SECOND)

    expect(halfway).toBeCloseTo(EDGE_SPEED / 2)
  })

  // The pointer leaves the window while a row is held at the bottom edge — which is the whole
  // reason this exists. Speed proportional to how far out would be unusable.
  it('holds at full speed however far past the edge the pointer goes', () => {
    expect(edgeScroll(BAND.bottom + 500, BAND, SECOND)).toBe(EDGE_SPEED)
  })

  it('answers for the time that actually passed, so the speed is the same on any machine', () => {
    expect(edgeScroll(BAND.bottom, BAND, 1 / 60)).toBeCloseTo(EDGE_SPEED / 60)
  })
})
