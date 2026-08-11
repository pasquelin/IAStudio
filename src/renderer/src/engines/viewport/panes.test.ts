import { describe, expect, it } from 'vitest'
import { glRect, isPaneLayout, paneAt, paneCount, paneRects } from './panes'

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

describe('glRect', () => {
  it('flips the origin to the bottom-left and scales to device pixels', () => {
    expect(glRect({ x: 0, y: 0, width: 400, height: 300 }, 600, 1)).toEqual({
      x: 0,
      y: 300,
      width: 400,
      height: 300,
    })
    expect(glRect({ x: 400, y: 300, width: 400, height: 300 }, 600, 2)).toEqual({
      x: 800,
      y: 0,
      width: 800,
      height: 600,
    })
  })
})
