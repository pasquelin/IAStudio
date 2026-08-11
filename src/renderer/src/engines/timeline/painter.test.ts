import { describe, expect, it, vi } from 'vitest'
import { forgetPalette, paintTimeline } from './painter'
import {
  CLIP_INSET,
  EDGE_BAR_INSET,
  EDGE_BAR_WIDTH,
  FADE_BAND,
  RULER_HEIGHT,
  type Viewport,
} from './timeline-geometry'
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

type Point = { x: number; y: number }

/** Records what was painted, so the test asserts on rectangles and labels, not on pixels. */
function spyContext() {
  const rects: Rect[] = []
  const texts: { text: string; x: number; y: number }[] = []
  const lines: Point[] = []
  const images: Rect[] = []

  const context = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => lines.push({ x, y })),
    lineTo: vi.fn((x: number, y: number) => lines.push({ x, y })),
    rect: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn((_source: unknown, x: number, y: number, width: number, height: number) =>
      images.push({ x, y, width, height }),
    ),
    fillText: vi.fn((text: string, x: number, y: number) => texts.push({ text, x, y })),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) =>
      rects.push({ x, y, width, height }),
    ),
  }

  // Every assignment kept, not just the last: the painter sets one font for the ruler and
  // another for the clips, and reading the property back would only ever show the second.
  const fonts: string[] = []
  Object.defineProperty(context, 'font', {
    get: () => fonts.at(-1) ?? '',
    set: (value: string) => void fonts.push(value),
  })

  // jsdom has no usable 2D context; the painter only ever calls these members.
  return {
    context: context as unknown as CanvasRenderingContext2D,
    rects,
    texts,
    lines,
    images,
    fonts,
  }
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
      labelOf: () => 'Soft pad',
    })

    expect(texts.map(entry => entry.text)).toContain('Soft pad')
  })

  it('sizes what it paints from the ladder, so the text preference reaches the canvas', () => {
    document.documentElement.style.setProperty('--text-tiny', '22px')
    document.documentElement.style.setProperty('--text-mini', '20px')
    forgetPalette()

    // Restored even on a failed assertion: the palette is a module cache and the tokens are on
    // the shared root, so leaking either would fail the NEXT test and accuse the wrong code.
    try {
      const { context, fonts } = spyContext()
      paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size)

      expect(fonts).toContain('22px ui-sans-serif, system-ui')
      expect(fonts).toContain('20px ui-monospace, monospace')
    } finally {
      document.documentElement.style.removeProperty('--text-tiny')
      document.documentElement.style.removeProperty('--text-mini')
      forgetPalette()
    }
  })

  it('keeps the shipped size when no token answers, rather than a shorthand with no size', () => {
    forgetPalette()

    const { context, fonts } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size)

    expect(fonts).toContain('11px ui-sans-serif, system-ui')
    expect(fonts).toContain('10px ui-monospace, monospace')
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

  it('cuts a wedge out of each end of a clip that carries fades', () => {
    const { context, lines } = spyContext()
    const faded = { ...clip('a', 0, 1_000_000), fadeIn: 200_000, fadeOut: 200_000 }
    paintTimeline(context, stateWith([faded]), viewport, size)

    // The ramps end 20 px in and 20 px before the tail, at 100 px a second.
    expect(lines.map(point => point.x)).toEqual(expect.arrayContaining([20, 80]))
  })

  it('draws no wedge for a clip with no fades', () => {
    const { context, lines } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size)

    expect(lines).toHaveLength(0)
  })

  it('draws a waveform when the clip has peaks to draw', () => {
    const { context, lines } = spyContext()
    const peaks = new Float32Array([-1, 1, -0.5, 0.5])
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size, {
      peaksOf: () => peaks,
    })

    expect(lines.length).toBeGreaterThan(0)
  })

  it('draws no waveform for a clip nothing was decoded for', () => {
    const { context, lines } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size, {
      peaksOf: () => null,
    })

    expect(lines).toHaveLength(0)
  })

  it('lays a poster across the head of a clip, never across the whole of it', () => {
    const { context, images } = spyContext()
    // A stand-in: the painter only ever hands it to `drawImage`, which the spy records.
    const poster = {} as CanvasImageSource
    paintTimeline(context, stateWith([clip('a', 0, 10_000_000)]), viewport, size, {
      posterOf: () => poster,
    })

    expect(images).toHaveLength(1)
    expect(images[0]?.width).toBeLessThan(1_000)
  })

  it('never lets a poster spill past a clip shorter than it', () => {
    const { context, images } = spyContext()
    // Same stand-in as above.
    const poster = {} as CanvasImageSource
    // 100 ms is 10 px wide, narrower than the poster would like to be.
    paintTimeline(context, stateWith([clip('a', 0, 100_000)]), viewport, size, {
      posterOf: () => poster,
    })

    expect(images[0]?.width).toBe(10)
  })

  it('marks both ends of a clip with a grip, which is what says it can be lengthened', () => {
    const { context, rects } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size)

    // 100 px wide, in a box inset by CLIP_INSET, the bar starting below the fade band.
    const boxHeight = TRACK_HEIGHT - CLIP_INSET * 2 - 1
    const bar = {
      y: RULER_HEIGHT + FADE_BAND,
      width: EDGE_BAR_WIDTH,
      height: boxHeight - (FADE_BAND - CLIP_INSET) - EDGE_BAR_INSET,
    }

    expect(rects).toContainEqual({ x: 0, ...bar })
    expect(rects).toContainEqual({ x: 100 - EDGE_BAR_WIDTH, ...bar })
  })

  /**
   * The defect this guards against is the whole point of the bar: inside the fade band the same
   * corner opens a fade, not a trim. A bar drawn up there is pressed for a lengthening and hands
   * back a ramp — and with `fadeIn` at zero nothing else is painted there to warn of it.
   */
  it('starts the bar below the fade band, where the corner is a trim and not a fade', () => {
    const { context, rects } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size)

    const bars = rects.filter(rect => rect.width === EDGE_BAR_WIDTH)
    expect(bars).toHaveLength(2)
    for (const bar of bars) {
      // The band is measured from the row's top, which is the ruler height on the first track.
      expect(bar.y).toBeGreaterThanOrEqual(RULER_HEIGHT + FADE_BAND)
      expect(bar.height).toBeGreaterThan(0)
    }
  })

  it('draws a grip after the border, which is what puts it outside the clipping path', () => {
    const { context, rects } = spyContext()
    paintTimeline(context, stateWith([clip('a', 0, 1_000_000)]), viewport, size)

    // The border is painted once the clip path is restored; anything before it can be masked
    // by a poster, and a grip nobody sees says nothing about the end of a clip.
    const border = rects.findIndex(rect => rect.x === 0 && rect.width === 1)
    const grip = rects.findIndex(rect => rect.x === 0 && rect.width === EDGE_BAR_WIDTH)

    expect(border).toBeGreaterThan(-1)
    expect(grip).toBeGreaterThan(border)
  })

  it('leaves a clip too narrow to hold them unmarked, rather than covering it in grips', () => {
    const { context, rects } = spyContext()
    // 80 ms is 8 px wide: `edgeGrab` gives each edge under 3 px there, less than a grip needs.
    paintTimeline(context, stateWith([clip('a', 0, 80_000)]), viewport, size)

    expect(rects.filter(rect => rect.width === EDGE_BAR_WIDTH)).toHaveLength(0)
  })
})
