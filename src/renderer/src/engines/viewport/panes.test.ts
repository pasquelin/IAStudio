import { describe, expect, it } from 'vitest'
import {
  glRect,
  inRect,
  insetRect,
  isPaneLayout,
  paneAt,
  paneCount,
  paneRects,
  previewRect,
} from './panes'

describe('paneRects', () => {
  it('gives a single layout the whole surface', () => {
    expect(paneRects('single', 800, 600)).toEqual([{ x: 0, y: 0, width: 800, height: 600 }])
  })

  it('splits a quad layout into four quarters, reading left to right then top to bottom', () => {
    expect(paneRects('quad', 800, 600)).toEqual([
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 400, y: 0, width: 400, height: 300 },
      { x: 0, y: 300, width: 400, height: 300 },
      { x: 400, y: 300, width: 400, height: 300 },
    ])
  })

  it('leaves no pixel undrawn on an odd surface', () => {
    expect(paneRects('quad', 801, 601)).toEqual([
      { x: 0, y: 0, width: 400, height: 300 },
      { x: 400, y: 0, width: 401, height: 300 },
      { x: 0, y: 300, width: 400, height: 301 },
      { x: 400, y: 300, width: 401, height: 301 },
    ])
  })

  it('counts what it draws', () => {
    expect(paneCount('single')).toBe(1)
    expect(paneCount('quad')).toBe(4)
  })

  it('reads a layout back from a plain string', () => {
    expect(isPaneLayout('quad')).toBe(true)
    expect(isPaneLayout('triple')).toBe(false)
  })
})

describe('paneAt', () => {
  const rects = paneRects('quad', 800, 600)

  it('finds the pane a point falls in', () => {
    expect(paneAt(rects, 10, 10)).toBe(0)
    expect(paneAt(rects, 500, 10)).toBe(1)
    expect(paneAt(rects, 10, 500)).toBe(2)
    expect(paneAt(rects, 500, 500)).toBe(3)
  })

  it('gives a divider to the pane it opens, never to both', () => {
    expect(paneAt(rects, 400, 299)).toBe(1)
    expect(paneAt(rects, 399, 300)).toBe(2)
  })

  it('answers nothing outside the surface', () => {
    expect(paneAt(rects, -1, 10)).toBeNull()
    expect(paneAt(rects, 800, 10)).toBeNull()
    expect(paneAt(rects, 10, 600)).toBeNull()
  })
})

describe('insetRect', () => {
  const wide = 16 / 9

  /**
   * TOP right, and the corner is asserted rather than merely fitted in: the reason it is not the
   * lower one — the gizmo's arms reach down and out, under the very handles a hand aims for — is
   * written in `insetRect` and was held by nothing.
   */
  it('sits in the top-right corner, at the aspect of what the camera films', () => {
    const rect = insetRect(800, 600, wide)
    if (!rect) throw new Error('a surface of this size has room for a preview')

    expect(rect.width / rect.height).toBeCloseTo(wide, 1)
    // Nearer the top edge than the bottom one, and nearer the right edge than the left.
    expect(rect.y).toBeLessThan(600 - (rect.y + rect.height))
    expect(800 - (rect.x + rect.width)).toBeLessThan(rect.x)
    expect(rect.x + rect.width).toBeLessThan(800)
    expect(rect.y + rect.height).toBeLessThan(600)
  })

  it('stays the same share of a surface twice as wide', () => {
    const small = insetRect(800, 600, wide)
    const large = insetRect(1600, 1200, wide)

    expect(small && large && large.width / 1600).toBeCloseTo(small!.width / 800, 5)
  })

  // A preview wider than the view it sits on would hide the very thing it is a preview OF.
  it('answers nothing for a surface with no room for one', () => {
    expect(insetRect(200, 40, wide)).toBeNull()
    expect(insetRect(0, 0, wide)).toBeNull()
    expect(insetRect(800, 600, 0)).toBeNull()
  })
})

/**
 * The arithmetic of the two sizes and of the drag, which is why `panes.ts` exists at all — and
 * which nothing held: the component's own test asserts through jsdom, where every rectangle
 * measures zero, so a grown preview that never grew and a drag that never clamped both passed.
 */
describe('previewRect', () => {
  const wide = 16 / 9

  it('takes the whole surface when it is grown, whatever it was offset by', () => {
    expect(previewRect(800, 600, wide, 'full', { x: 90, y: -40 })).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    })
  })

  it('sits where the corner puts it when it is not', () => {
    expect(previewRect(800, 600, wide, 'inset')).toEqual(insetRect(800, 600, wide))
  })

  it('moves by what it was dragged', () => {
    const held = insetRect(800, 600, wide)
    const moved = previewRect(800, 600, wide, 'inset', { x: -30, y: 40 })
    if (!held || !moved) throw new Error('a surface of this size has room for a preview')

    expect(moved.x).toBe(held.x - 30)
    expect(moved.y).toBe(held.y + 40)
  })

  /**
   * Clamped rather than free: a preview pushed past the edge cannot be dragged back — the
   * pointer has nothing left to grab — and one shoved off screen cannot be told from one closed.
   */
  it('is held whole inside the view, however far it is pushed', () => {
    const far = previewRect(800, 600, wide, 'inset', { x: 5000, y: 5000 })
    const back = previewRect(800, 600, wide, 'inset', { x: -5000, y: -5000 })
    if (!far || !back) throw new Error('a surface of this size has room for a preview')

    expect(far.x + far.width).toBe(800)
    expect(far.y + far.height).toBe(600)
    expect(back).toMatchObject({ x: 0, y: 0 })
  })

  it('answers nothing for a surface with no room, at either size', () => {
    expect(previewRect(200, 40, wide, 'inset')).toBeNull()
    expect(previewRect(0, 0, wide, 'full')).toBeNull()
  })
})

describe('inRect', () => {
  const rect = { x: 10, y: 20, width: 100, height: 50 }

  it('claims its own edges the way paneAt does — the opening ones', () => {
    expect(inRect(rect, 10, 20)).toBe(true)
    expect(inRect(rect, 110, 40)).toBe(false)
    expect(inRect(rect, 60, 70)).toBe(false)
  })
})

describe('glRect', () => {
  it('flips the origin to the bottom-left', () => {
    expect(glRect({ x: 0, y: 0, width: 400, height: 300 }, 600)).toEqual({
      x: 0,
      y: 300,
      width: 400,
      height: 300,
    })
    expect(glRect({ x: 400, y: 300, width: 400, height: 300 }, 600)).toEqual({
      x: 400,
      y: 0,
      width: 400,
      height: 300,
    })
  })
})
