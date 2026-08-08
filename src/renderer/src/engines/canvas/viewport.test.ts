import { describe, expect, it } from 'vitest'
import {
  centerOn,
  clampScale,
  containIn,
  fitTo,
  MAX_SCALE,
  MIN_SCALE,
  nextZoom,
  previousZoom,
  toDocument,
  toScreen,
  visibleRect,
  zoomAt,
  type Viewport,
} from './viewport'

const VIEWPORT: Viewport = { x: 40, y: 20, scale: 2 }

describe('viewport', () => {
  it('maps a document point to the screen and back', () => {
    const screen = toScreen(VIEWPORT, { x: 10, y: 5 })

    expect(screen).toEqual({ x: 60, y: 30 })
    expect(toDocument(VIEWPORT, screen)).toEqual({ x: 10, y: 5 })
  })

  it('clamps a scale to what the renderer can show', () => {
    expect(clampScale(1000)).toBe(MAX_SCALE)
    expect(clampScale(0)).toBe(MIN_SCALE)
    expect(clampScale(Number.NaN)).toBe(1)
  })

  it('keeps the point under the anchor fixed while zooming', () => {
    const anchor = { x: 300, y: 180 }
    const before = toDocument(VIEWPORT, anchor)

    const zoomed = zoomAt(VIEWPORT, 8, anchor)

    expect(zoomed.scale).toBe(8)
    expect(toDocument(zoomed, anchor).x).toBeCloseTo(before.x)
    expect(toDocument(zoomed, anchor).y).toBeCloseTo(before.y)
  })

  it('fits a document inside the host with padding, centred', () => {
    const viewport = fitTo({ width: 1000, height: 500 }, { width: 548, height: 400 })

    expect(viewport.scale).toBeCloseTo(0.5)
    expect(viewport.x).toBe(24)
    expect(viewport.y).toBe(75)
  })

  // The ruler bands cover the top and left of the host: a document centred across the whole of
  // it would have its first rows under opaque chrome, unseen and unpaintable.
  it('leaves the chrome its corner when it is given an inset', () => {
    const viewport = fitTo({ width: 100, height: 100 }, { width: 500, height: 500 }, 20)

    expect(viewport).toEqual({ scale: 1, x: 210, y: 210 })
  })

  it('never magnifies a small document to fit', () => {
    expect(fitTo({ width: 10, height: 10 }, { width: 800, height: 600 }).scale).toBe(1)
  })

  it('centres at an explicit scale', () => {
    expect(centerOn({ width: 100, height: 100 }, { width: 300, height: 300 }, 1)).toEqual({
      scale: 1,
      x: 100,
      y: 100,
    })
  })

  it('walks the zoom stops in both directions', () => {
    expect(nextZoom(1)).toBe(1.5)
    expect(previousZoom(1)).toBe(0.6667)
    expect(nextZoom(MAX_SCALE)).toBe(MAX_SCALE)
    expect(previousZoom(MIN_SCALE)).toBe(MIN_SCALE)
  })

  it('does not stall on a stop it already sits on', () => {
    expect(nextZoom(0.9999999999)).toBe(1.5)
    expect(previousZoom(1.0000000001)).toBe(0.6667)
  })

  it('reports the document rectangle the host currently shows', () => {
    expect(visibleRect({ x: -100, y: -50, scale: 2 }, { width: 800, height: 600 })).toEqual({
      x: 50,
      y: 25,
      width: 400,
      height: 300,
    })
  })

  describe('laying a picture inside the document', () => {
    it('centres one that already fits, at its own size', () => {
      expect(containIn({ width: 400, height: 200 }, { width: 1024, height: 1024 })).toEqual({
        x: 312,
        y: 412,
        width: 400,
        height: 200,
      })
    })

    // Magnifying an import would blur it on arrival, with no way back to its own pixels.
    it('never magnifies a small one to fill the canvas', () => {
      const laid = containIn({ width: 10, height: 10 }, { width: 1024, height: 1024 })

      expect(laid.width).toBe(10)
    })

    it('shrinks one that overflows without deforming it', () => {
      const laid = containIn({ width: 4000, height: 2000 }, { width: 1000, height: 1000 })

      expect(laid).toEqual({ x: 0, y: 250, width: 1000, height: 500 })
    })
  })
})
