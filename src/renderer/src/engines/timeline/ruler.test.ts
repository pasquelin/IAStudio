import { describe, expect, it, vi } from 'vitest'
import { SECOND, frameDuration } from '@shared/domain/time'
import { paintRuler, tickStep, type RulerStyle } from './ruler'
import { RULER_HEIGHT, type Viewport } from './timelineGeometry'

const style: RulerStyle = {
  background: '#111',
  tick: '#222',
  text: '#333',
  font: '10px monospace',
}

const viewportAt = (scale: number, offset = 0): Viewport => ({ scale, offset, scrollTop: 0 })

/** One pixel per 10 ms, so a second is a hundred pixels. */
const HUNDRED_PX_PER_SECOND = 100 / SECOND

type Rect = { x: number; y: number; width: number; height: number }

function spyContext() {
  const rects: Rect[] = []
  const texts: { text: string; x: number }[] = []

  const context = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    fillText: vi.fn((text: string, x: number) => void texts.push({ text, x })),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) =>
      rects.push({ x, y, width, height }),
    ),
  }

  // jsdom has no usable 2D context; the ruler only ever calls these two.
  return { context: context as unknown as CanvasRenderingContext2D, rects, texts }
}

describe('choosing a graduation', () => {
  it('counts in frames while a frame is wide enough to read', () => {
    // A frame at 25 fps is 40 ms; at 2 px per ms one frame is already 80 px across.
    expect(tickStep(2 / 1000, 25)).toBe(frameDuration(25))
  })

  it('leaves the frame grid for whole seconds once frames crowd', () => {
    const step = tickStep(HUNDRED_PX_PER_SECOND, 25)
    expect(step % SECOND).toBe(0)
    expect(step).toBeGreaterThanOrEqual(SECOND)
  })

  it('never crowds two graduations closer than sixty pixels', () => {
    for (const scale of [1 / SECOND, 10 / SECOND, HUNDRED_PX_PER_SECOND, 2 / 1000]) {
      expect(tickStep(scale, 25) * scale).toBeGreaterThanOrEqual(60)
    }
  })

  it('still answers a step when even a quarter hour would crowd', () => {
    expect(tickStep(1e-12, 25)).toBe(1_800 * SECOND)
  })

  it('follows the rate it is given rather than assuming one', () => {
    expect(tickStep(2 / 1000, 24)).toBe(frameDuration(24))
    expect(tickStep(2 / 1000, 30)).toBe(frameDuration(30))
  })
})

describe('painting the ruler', () => {
  it('fills its own strip and rules a line under it', () => {
    const { context, rects } = spyContext()
    paintRuler(context, { viewport: viewportAt(HUNDRED_PX_PER_SECOND), width: 800, fps: 25, style })

    expect(rects[0]).toEqual({ x: 0, y: 0, width: 800, height: RULER_HEIGHT })
    expect(rects.at(-1)).toEqual({ x: 0, y: RULER_HEIGHT - 1, width: 800, height: 1 })
  })

  it('labels the graduations as timecode, starting at the origin', () => {
    const { context, texts } = spyContext()
    paintRuler(context, { viewport: viewportAt(HUNDRED_PX_PER_SECOND), width: 800, fps: 25, style })

    expect(texts[0]?.text).toBe('00:00:00:00')
    expect(texts.every(label => /^\d\d:\d\d:\d\d:\d\d$/.test(label.text))).toBe(true)
  })

  it('starts at the first graduation before the left edge, not at the edge itself', () => {
    const { context, texts } = spyContext()
    const scrolled = viewportAt(HUNDRED_PX_PER_SECOND, 2.5 * SECOND)
    paintRuler(context, { viewport: scrolled, width: 800, fps: 25, style })

    // Rounded down to the graduation below, so a label is never cut off the left edge.
    expect(texts[0]?.text).toBe('00:00:02:00')
  })

  it('graduates a wider view more often than a narrow one, at one scale', () => {
    const countAt = (width: number): number => {
      const { context, texts } = spyContext()
      paintRuler(context, { viewport: viewportAt(HUNDRED_PX_PER_SECOND), width, fps: 25, style })
      return texts.length
    }

    expect(countAt(1600)).toBeGreaterThan(countAt(400))
  })

  it('holds to the origin alone when there is no width to graduate', () => {
    const { context, texts } = spyContext()
    paintRuler(context, { viewport: viewportAt(HUNDRED_PX_PER_SECOND), width: 0, fps: 25, style })

    // The visible range collapses to `[0, 0]`, and the loop's bound is inclusive.
    expect(texts).toHaveLength(1)
    expect(texts[0]?.text).toBe('00:00:00:00')
  })
})
