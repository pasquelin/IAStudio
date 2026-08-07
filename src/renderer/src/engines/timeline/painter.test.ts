import { describe, expect, it, vi } from 'vitest'
import { paintTimeline } from './painter'
import { RULER_HEIGHT, type Viewport } from './timeline-geometry'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import {
  DEFAULT_TRACK_HEIGHT,
  EMPTY_SEQUENCE,
  type Clip,
  type SequenceState,
} from './timeline-state'

const viewport: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }
const size = { width: 800, height: 200 }
const TRACK_HEIGHT = DEFAULT_TRACK_HEIGHT

const clip = clipFixture

const stateWith = (clips: Clip[]): SequenceState =>
  sequenceWith([trackFixture('V1', 'video', clips)])

type Rect = { x: number; y: number; width: number; height: number }

/** Records what was painted, so the test asserts on rectangles and labels, not on pixels. */
function spyContext() {
  const rects: Rect[] = []
  const texts: { text: string; x: number; y: number }[] = []

  const context = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => texts.push({ text, x, y })),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) =>
      rects.push({ x, y, width, height }),
    ),
  }

  // jsdom has no usable 2D context; the painter only ever calls these members.
  return { context: context as unknown as CanvasRenderingContext2D, rects, texts }
}

describe('timeline painter', () => {
  it('paints a row for every track, so an empty timeline still reads as a timeline', () => {
    const { context, rects } = spyContext()
    paintTimeline(context, EMPTY_SEQUENCE, viewport, size)

    expect(rects).toContainEqual({ x: 0, y: RULER_HEIGHT, width: size.width, height: TRACK_HEIGHT })
    expect(rects).toContainEqual({
      x: 0,
      y: RULER_HEIGHT + TRACK_HEIGHT,
      width: size.width,
      height: TRACK_HEIGHT,
    })
  })

  it('gives each row the height its own track carries', () => {
    const { context, rects } = spyContext()
    const uneven = sequenceWith([
      trackFixture('V1', 'video', [], { height: 40 }),
      trackFixture('A1', 'audio', [], { height: 80 }),
    ])
    paintTimeline(context, uneven, viewport, size)

    expect(rects).toContainEqual({ x: 0, y: RULER_HEIGHT, width: size.width, height: 40 })
    expect(rects).toContainEqual({ x: 0, y: RULER_HEIGHT + 40, width: size.width, height: 80 })
  })

  it('labels a clip with what the caller calls it, not with its asset id', () => {
    const { context, texts } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size, {
      labelOf: () => 'Nappe douce',
    })

    expect(texts.map(entry => entry.text)).toContain('Nappe douce')
  })

  it('graduates the ruler in timecode', () => {
    const { context, texts } = spyContext()
    paintTimeline(context, EMPTY_SEQUENCE, viewport, size)

    expect(texts.map(entry => entry.text)).toContain('00:00:01:00')
  })

  it('paints a visible clip at its computed position', () => {
    const { context, rects } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size)

    expect(rects).toContainEqual({
      x: 0,
      y: RULER_HEIGHT + 2,
      width: 100,
      height: TRACK_HEIGHT - 5,
    })
  })

  it('labels a clip with the asset it plays', () => {
    const { context, texts } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size)

    expect(texts.map(entry => entry.text)).toContain('asset-a')
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
    paintTimeline(
      context,
      stateWith([clip('a', 0, 1_000_000)]),
      { ...viewport, scrollTop: 1_000 },
      size,
    )

    expect(rects.some(rect => rect.width === 100)).toBe(false)
  })
})
