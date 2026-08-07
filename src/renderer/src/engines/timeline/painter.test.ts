import { describe, expect, it, vi } from 'vitest'
import { paintTimeline } from './painter'
import { RULER_HEIGHT, TRACK_HEIGHT, type Viewport } from './timeline-geometry'
import { EMPTY_SEQUENCE, type Clip, type SequenceState } from './timeline-state'

const viewport: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }
const size = { width: 800, height: 200 }

const clip = (id: string, start: number, duration: number): Clip => ({
  id,
  assetId: `asset-${id}`,
  start,
  duration,
  inPoint: 0,
  speed: 1,
})

const stateWith = (clips: Clip[]): SequenceState => ({
  ...EMPTY_SEQUENCE,
  tracks: [{ id: 'V1', kind: 'video', index: 1, muted: false, locked: false, clips }],
})

/** Records what was painted, so the test asserts on rectangles instead of pixels. */
function spyContext() {
  const rects: { x: number; y: number; width: number; height: number }[] = []
  const context = {
    fillStyle: '',
    strokeStyle: '',
    clearRect: vi.fn(),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) =>
      rects.push({ x, y, width, height }),
    ),
  }
  // jsdom has no usable 2D context; the painter only ever calls these members.
  return { context: context as unknown as CanvasRenderingContext2D, rects }
}

describe('timeline painter', () => {
  it('paints a rectangle for a visible clip, at its computed position', () => {
    const { context, rects } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size)
    expect(rects).toContainEqual({ x: 0, y: RULER_HEIGHT, width: 100, height: TRACK_HEIGHT })
  })

  it('paints nothing for a clip entirely off screen', () => {
    const { context, rects } = spyContext()
    paintTimeline(context, stateWith([clip('a', 60_000_000, 1_000_000)]), viewport, size)
    expect(rects.some(rect => rect.width === 100)).toBe(false)
  })

  it('paints the playhead as a one-pixel column', () => {
    const { context, rects } = spyContext()
    paintTimeline(context, { ...stateWith([]), playhead: 2_000_000 }, viewport, size)
    expect(rects).toContainEqual({ x: 200, y: 0, width: 1, height: size.height })
  })

  it('clears before painting, so a scrub never leaves a trail', () => {
    const { context } = spyContext()
    paintTimeline(context, stateWith([]), viewport, size)
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, size.width, size.height)
  })

  it('skips a track scrolled out of view', () => {
    const { context, rects } = spyContext()
    const scrolled: Viewport = { ...viewport, scrollTop: 1_000 }
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), scrolled, size)
    expect(rects.some(rect => rect.width === 100)).toBe(false)
  })
})
