import { describe, expect, it } from 'vitest'
import type { HandleId } from './handles'
import { resizeCursor, rotateCursor, UPRIGHT, type Facing } from './cursors'

/** Typed here rather than inferred: `it.each` would widen the ids to plain strings. */
const ARROWS: readonly [HandleId, string][] = [
  ['e', 'ew-resize'],
  ['se', 'nwse-resize'],
  ['s', 'ns-resize'],
  ['sw', 'nesw-resize'],
  ['w', 'ew-resize'],
  ['nw', 'nwse-resize'],
  ['n', 'ns-resize'],
  ['ne', 'nesw-resize'],
]

const QUARTER: Facing = { ...UPRIGHT, rotation: Math.PI / 2 }
const EIGHTH: Facing = { ...UPRIGHT, rotation: Math.PI / 4 }
const MIRRORED: Facing = { ...UPRIGHT, scaleX: -1 }

describe('the cursor over a resize grip', () => {
  /**
   * All eight, and not a sample: the table is a run of thresholds, and one wrong bound would
   * only ever show up on the single octant nobody thought to try.
   */
  it.each(ARROWS)('points the right way for the %s grip of an untouched layer', (handle, arrow) => {
    expect(resizeCursor(handle, UPRIGHT)).toBe(arrow)
  })

  /**
   * The two ends of a diagonal are the same gesture, and the platform offers one arrow for both:
   * a box turned half a turn must not flip the cursor under a hand that has not moved.
   */
  it('gives opposite grips the same arrow', () => {
    expect(resizeCursor('se', UPRIGHT)).toBe(resizeCursor('nw', UPRIGHT))
    expect(resizeCursor('e', UPRIGHT)).toBe(resizeCursor('w', UPRIGHT))
  })

  it('follows the layer round: a quarter turn swaps the two axes', () => {
    expect(resizeCursor('e', QUARTER)).toBe('ns-resize')
    expect(resizeCursor('n', QUARTER)).toBe('ew-resize')
  })

  it('turns an edge grip onto a diagonal at an eighth of a turn', () => {
    expect(resizeCursor('e', EIGHTH)).toBe('nwse-resize')
  })

  /**
   * A mirror is not a turn: it reflects, so the two diagonals swap. The grip named `nw` is drawn
   * top-*right* on a layer with a negative scale, and pulling it goes up and to the right.
   */
  it('crosses the diagonals on a mirrored layer', () => {
    expect(resizeCursor('nw', MIRRORED)).toBe('nesw-resize')
    expect(resizeCursor('ne', MIRRORED)).toBe('nwse-resize')
  })

  // Only the sign of a scale is read. Its size is what would bend the arrow to the box's shape.
  it('ignores how far a layer was scaled, only which way', () => {
    expect(resizeCursor('ne', { rotation: 0, scaleX: 4, scaleY: 0.25 })).toBe('nesw-resize')
  })

  // A collapsed axis has no direction of its own: reading its sign as zero would flatten the
  // arrow onto one axis rather than leaving it where the other one puts it.
  it('reads a collapsed axis as unmirrored rather than as no direction', () => {
    expect(resizeCursor('ne', { rotation: 0, scaleX: 0, scaleY: 0 })).toBe('nesw-resize')
  })
})

describe('the drawn rotation cursor', () => {
  it('is an image cursor with the hotspot in its middle', () => {
    expect(rotateCursor('nw', UPRIGHT)).toContain('data:image/svg+xml')
    expect(rotateCursor('nw', UPRIGHT)).toContain('12 12')
  })

  // No platform ships one, so a platform that refuses an image cursor still gets something.
  it('falls back rather than leaving no cursor at all', () => {
    expect(rotateCursor('nw', UPRIGHT)).toMatch(/, pointer$/)
  })

  it('turns with the corner it is shown on', () => {
    expect(rotateCursor('nw', UPRIGHT)).not.toBe(rotateCursor('ne', UPRIGHT))
  })

  it('turns with the layer, so the same corner reads differently once it is rotated', () => {
    expect(rotateCursor('nw', UPRIGHT)).not.toBe(rotateCursor('nw', QUARTER))
  })

  // Quantised, so the cache stays bounded and two neighbouring angles share one image.
  it('gives one image to angles inside the same step', () => {
    expect(rotateCursor('nw', UPRIGHT)).toBe(rotateCursor('nw', { ...UPRIGHT, rotation: 0.01 }))
  })

  // A quarter turn on a corner lands the tangent back where another corner already was.
  it('reuses one image for two angles that come out the same', () => {
    expect(rotateCursor('nw', QUARTER)).toBe(rotateCursor('ne', UPRIGHT))
  })
})
