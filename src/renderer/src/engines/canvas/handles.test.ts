import { describe, expect, it } from 'vitest'
import { IDENTITY, type Rect } from './canvas-state'
import { handleAt, handlePoints, resizeBy, rotateBy, ROTATE_OFFSET } from './handles'

const BOX: Rect = { x: 100, y: 100, width: 200, height: 100 }

describe('where the grips sit', () => {
  it('puts eight on the edge of the box', () => {
    const points = handlePoints(BOX)

    expect(points.nw).toEqual({ x: 100, y: 100 })
    expect(points.se).toEqual({ x: 300, y: 200 })
    expect(points.n).toEqual({ x: 200, y: 100 })
    expect(points.w).toEqual({ x: 100, y: 150 })
  })

  // Above the box, or it would sit on the north grip and neither could be taken.
  it('floats the rotation grip clear of the top edge', () => {
    expect(handlePoints(BOX).rotate).toEqual({ x: 200, y: 100 - ROTATE_OFFSET })
  })
})

describe('taking a grip', () => {
  it('finds the one under the pointer', () => {
    expect(handleAt(BOX, { x: 302, y: 199 }, 6)).toBe('se')
  })

  it('finds none in the middle of the box', () => {
    expect(handleAt(BOX, { x: 200, y: 150 }, 6)).toBeNull()
  })

  it('finds none beyond the tolerance it was given', () => {
    expect(handleAt(BOX, { x: 320, y: 200 }, 6)).toBeNull()
  })
})

describe('pulling a grip', () => {
  // The opposite corner stays put, which is the only behaviour that lets a layer be sized
  // against something else on the canvas.
  it('doubles the width when the east grip is pulled twice as far', () => {
    const after = resizeBy(IDENTITY, 'e', BOX, { x: 500, y: 150 }, false)

    expect(after.scaleX).toBe(2)
  })

  it('leaves the other axis alone for a grip on an edge', () => {
    const after = resizeBy(IDENTITY, 'e', BOX, { x: 500, y: 500 }, false)

    expect(after.scaleY).toBe(1)
  })

  it('pulls both axes from a corner', () => {
    const after = resizeBy(IDENTITY, 'se', BOX, { x: 500, y: 300 }, false)

    expect(after.scaleX).toBe(2)
    expect(after.scaleY).toBe(2)
  })

  // Shift keeps a picture's shape, as it does everywhere else in the studio.
  it('follows the longer side on both axes when the modifier is held', () => {
    const after = resizeBy(IDENTITY, 'se', BOX, { x: 500, y: 220 }, true)

    expect(after.scaleX).toBe(after.scaleY)
  })

  it('pulls against the far corner, so a west grip moves the layer with it', () => {
    // The box spans 100 to 300; pulling its west edge out to -100 makes it twice as wide.
    const after = resizeBy({ ...IDENTITY, x: 100 }, 'w', BOX, { x: -100, y: 150 }, false)

    expect(after.scaleX).toBe(2)
    expect(after.x).toBeLessThan(100)
  })

  // A zero-width box would scale a layer to nothing it could ever be pulled back from.
  it('refuses to collapse a box that has no width', () => {
    const flat: Rect = { x: 0, y: 0, width: 0, height: 10 }

    expect(resizeBy(IDENTITY, 'e', flat, { x: 50, y: 5 }, false).scaleX).toBe(1)
  })

  it('does nothing at all for the rotation grip', () => {
    expect(resizeBy(IDENTITY, 'rotate', BOX, { x: 500, y: 500 }, false)).toEqual(IDENTITY)
  })
})

describe('turning by the rotation grip', () => {
  it('adds the angle the hand swept about the middle of the box', () => {
    // From due north of the middle to due east of it: a quarter turn.
    const after = rotateBy(IDENTITY, BOX, { x: 200, y: 50 }, { x: 300, y: 150 })

    expect(after.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('adds to whatever the layer was already turned by', () => {
    const turned = { ...IDENTITY, rotation: Math.PI }
    const after = rotateBy(turned, BOX, { x: 200, y: 50 }, { x: 300, y: 150 })

    expect(after.rotation).toBeCloseTo(Math.PI + Math.PI / 2)
  })
})
