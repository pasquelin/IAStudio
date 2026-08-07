import { describe, expect, it } from 'vitest'
import { RULER_HEIGHT, xToTime, type Viewport } from './timeline-geometry'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import { EMPTY_SEQUENCE } from './timeline-state'
import {
  clampScale,
  clampViewport,
  DEFAULT_VIEWPORT,
  fitToWidth,
  MAX_SCALE,
  maxScrollTop,
  MIN_SCALE,
  revealTime,
  scrollBy,
  zoomAt,
} from './viewport'

const size = { width: 800, height: 200 }

const tenSeconds = sequenceWith([trackFixture('V1', 'video', [clipFixture('a', 0, 10_000_000)])])

describe('scale', () => {
  it('stays between one pixel a second and two thousand', () => {
    expect(clampScale(0)).toBe(MIN_SCALE)
    expect(clampScale(1)).toBe(MAX_SCALE)
    expect(clampScale(DEFAULT_VIEWPORT.scale)).toBe(DEFAULT_VIEWPORT.scale)
  })
})

describe('zoom', () => {
  it('keeps the instant under the cursor under the cursor', () => {
    const before = xToTime(300, DEFAULT_VIEWPORT)
    const zoomed = zoomAt(DEFAULT_VIEWPORT, 2, 300)

    expect(zoomed.scale).toBe(DEFAULT_VIEWPORT.scale * 2)
    // Rounding to whole microseconds is the only slack allowed here.
    expect(Math.abs(xToTime(300, zoomed) - before)).toBeLessThanOrEqual(1)
  })

  it('never scrolls left of the start when zooming out near it', () => {
    expect(zoomAt(DEFAULT_VIEWPORT, 0.5, 100).offset).toBe(0)
  })

  it('returns the same viewport once it is at a bound, so nothing re-renders for nothing', () => {
    const widest: Viewport = { ...DEFAULT_VIEWPORT, scale: MIN_SCALE }
    expect(zoomAt(widest, 0.5, 100)).toBe(widest)
  })
})

describe('scrolling', () => {
  it('moves the view horizontally in time and vertically in pixels', () => {
    const moved = scrollBy(DEFAULT_VIEWPORT, 100, 20)
    expect(moved.offset).toBe(1_000_000)
    expect(moved.scrollTop).toBe(20)
  })

  it('never scrolls before the start of the sequence', () => {
    expect(scrollBy(DEFAULT_VIEWPORT, -500, -80)).toMatchObject({ offset: 0, scrollTop: 0 })
  })

  it('stops scrolling down once the last track is in view', () => {
    // Two default rows of 56 px, in a 200 px strip minus the ruler: everything already fits.
    expect(maxScrollTop(EMPTY_SEQUENCE, size.height)).toBe(0)
    expect(maxScrollTop(EMPTY_SEQUENCE, 80)).toBe(112 - (80 - RULER_HEIGHT))
  })
})

describe('clamping', () => {
  it('pulls a viewport back inside its sequence', () => {
    const wild: Viewport = { scale: 10, offset: -500, scrollTop: 9_000 }
    const clamped = clampViewport(wild, EMPTY_SEQUENCE, size)

    expect(clamped.scale).toBe(MAX_SCALE)
    expect(clamped.offset).toBe(0)
    expect(clamped.scrollTop).toBe(0)
  })

  it('lets the view run half a screen past the end, and no further', () => {
    const far: Viewport = { ...DEFAULT_VIEWPORT, offset: 60_000_000 }
    // 800 px at 100 px/s shows 8 s, so the end may come as close as the middle of the strip.
    expect(clampViewport(far, tenSeconds, size).offset).toBe(6_000_000)
  })
})

describe('fitting', () => {
  it('lays the whole sequence across the strip', () => {
    const fitted = fitToWidth(tenSeconds, size.width)
    expect(fitted.offset).toBe(0)
    expect(10_000_000 * fitted.scale).toBeCloseTo(size.width * 0.96)
  })

  it('falls back to the default zoom on an empty sequence, which has nothing to fit', () => {
    expect(fitToWidth(EMPTY_SEQUENCE, size.width)).toEqual(DEFAULT_VIEWPORT)
  })
})

describe('revealing an instant', () => {
  it('leaves the view alone while the instant is already visible', () => {
    expect(revealTime(DEFAULT_VIEWPORT, 2_000_000, size.width)).toBe(DEFAULT_VIEWPORT)
  })

  it('centres on an instant that has run off the right edge', () => {
    expect(revealTime(DEFAULT_VIEWPORT, 20_000_000, size.width).offset).toBe(16_000_000)
  })

  it('never centres past the start when the instant is near zero', () => {
    const scrolled: Viewport = { ...DEFAULT_VIEWPORT, offset: 30_000_000 }
    expect(revealTime(scrolled, 1_000_000, size.width).offset).toBe(0)
  })
})

describe('a viewport that did not move', () => {
  const state = sequenceWith([trackFixture('V1', 'video', [clipFixture('a', 0, 60_000_000)])])
  const size = { width: 800, height: 400 }

  // Panning against an edge would otherwise write to the store and repaint on every pixel.
  it('is handed back as it was, rather than as a new object', () => {
    const clamped = clampViewport(DEFAULT_VIEWPORT, state, size)
    expect(clampViewport(clamped, state, size)).toBe(clamped)
  })

  it('is still clamped when it did move', () => {
    const past = { ...DEFAULT_VIEWPORT, offset: -100 }
    expect(clampViewport(past, state, size).offset).toBe(0)
  })
})
