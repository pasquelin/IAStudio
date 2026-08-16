import { describe, expect, it } from 'vitest'
import { PEAKS_PER_SECOND } from '@shared/domain/asset'
import { SECOND } from '@shared/domain/time'
import { paintProgram, programColumns, programEnvelope, programViewport } from './program-wave'
import type { Viewport } from './timeline-geometry'
import { clipFixture } from './timeline-fixtures'
import { EMPTY_SOUND_SEQUENCE, makeTrack, type SequenceState } from './timeline-state'
import { MAX_SCALE } from './viewport'

/** 100 px per second, as the strip's own suite reads it. */
const viewport: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

/** `seconds` worth of pairs, each one a flat ±`level`. */
const flat = (seconds: number, level: number): Float32Array => {
  const pairs = seconds * PEAKS_PER_SECOND
  const peaks = new Float32Array(pairs * 2)
  for (let pair = 0; pair < pairs; pair++) {
    peaks[pair * 2] = -level
    peaks[pair * 2 + 1] = level
  }
  return peaks
}

const montage = (tracks: SequenceState['tracks']): SequenceState => ({
  ...EMPTY_SOUND_SEQUENCE,
  tracks,
})

const sounding = (id: string, clipId: string, gain = 0) =>
  makeTrack({
    id,
    kind: 'audio',
    index: 0,
    clips: [clipFixture(clipId, 0, 1_000_000, { assetId: clipId, gain })],
  })

const peaks = flat(1, 0.25)

/**
 * The monitor says WHERE in the montage one is, which a waveform alone never did: the strip below
 * carries the same graduations, and the pair now reads as one grid rather than as a picture above
 * a scale.
 */
describe('the programme monitor', () => {
  const painted = () => {
    const labels: string[] = []
    const filled: string[] = []
    const strokes = { count: 0 }
    let ink = ''
    const context = {
      fillRect: () => filled.push(ink),
      fill: () => filled.push(ink),
      fillText: (text: string) => labels.push(text),
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      rect: () => {},
      clip: () => {},
      lineTo: () => {},
      stroke: () => strokes.count++,
      set fillStyle(colour: string) {
        ink = colour
      },
      set strokeStyle(_ink: string) {},
      set lineWidth(_width: number) {},
      set font(_font: string) {},
      set textBaseline(_baseline: string) {},
      // `as`: what these painters ask of a 2D context is the members above, and jsdom builds none.
    } as unknown as CanvasRenderingContext2D

    return {
      labels,
      filled,
      context,
      get stroked() {
        return strokes.count
      },
    }
  }

  const style = { background: 'a', tick: 'b', text: 'c', font: '10px monospace' }

  const palette = {
    safe: 'green',
    hot: 'amber',
    clip: 'red',
    envelope: 'groove',
    playhead: 'p',
    background: 'bg',
    ruler: style,
    scale: 'grid',
  }

  const paint = (
    state: SequenceState,
    { level = 1, ...over }: Partial<typeof palette> & { level?: number } = {},
  ) => {
    const surface = painted()
    const heard = flat(1, level)
    paintProgram(
      surface.context,
      state,
      () => heard,
      { width: 400, height: 120 },
      { ...palette, ...over },
      programViewport(state, 400),
    )
    return surface
  }

  it('graduates the time across its width', () => {
    const { labels } = paint(montage([sounding('A1', 'a')]))

    // A timecode, not a bare number of microseconds: the same reading as the strip's.
    expect(labels.some(label => /^\d\d:\d\d:\d\d/.test(label))).toBe(true)
  })

  /**
   * The three bands are what the monitor gained: a montage is read by how close it stands to the
   * ceiling, and one grey said nothing about that.
   */
  it('lays the wave down in all three bands of the level scale', () => {
    const { filled } = paint(montage([sounding('A1', 'a')]))

    expect(filled).toContain('green')
    expect(filled).toContain('amber')
    expect(filled).toContain('red')
    // Calm first: the louder bands are painted over it, showing only what reaches past them.
    expect(filled.indexOf('green')).toBeLessThan(filled.indexOf('amber'))
    expect(filled.indexOf('amber')).toBeLessThan(filled.indexOf('red'))
  })

  /**
   * Each band walks every column twice and clips the whole canvas, and this runs on every frame
   * of playback: a quiet montage must not pay for two passes that draw nothing.
   */
  it('leaves out the bands nothing in the montage reaches', () => {
    const quiet = paint(montage([sounding('A1', 'a')]), { level: 0.1 }).filled
    const loud = paint(montage([sounding('A1', 'a')]), { level: 0.8 }).filled

    expect(quiet).toContain('green')
    expect(quiet).not.toContain('amber')
    expect(quiet).not.toContain('red')
    // Amber is reached, full scale is not: the red pass alone is skipped.
    expect(loud).toContain('amber')
    expect(loud).not.toContain('red')
  })

  it('graduates the levels behind the wave, and writes nothing on them', () => {
    const { filled, labels } = paint(montage([sounding('A1', 'a')]))

    expect(filled).toContain('grid')
    // The lines carried their decibels in writing until 2026-08-16: on a linear axis the three
    // stacked on top of one another around the middle, −12 and −18 a few pixels apart.
    expect(labels.some(label => /dB/.test(label))).toBe(false)
  })

  /** The one mark here that answers a question not every pass is asking, so it can be taken away. */
  it('leaves the envelope out when the reader has taken the curves away', () => {
    const shown = paint(montage([sounding('A1', 'a')]))
    const hidden = paint(montage([sounding('A1', 'a')]), { envelope: undefined })

    expect(shown.stroked).toBeGreaterThan(0)
    expect(hidden.stroked).toBe(0)
  })
})

/**
 * The view the monitor opens on, and the one its fit button goes back to. Both bounds are wrong
 * here in opposite ways, and only one of them belongs.
 */
describe('fitting a montage to the monitor', () => {
  const lasting = (seconds: number): SequenceState =>
    montage([
      makeTrack({
        id: 'A1',
        kind: 'audio',
        index: 0,
        clips: [clipFixture('long', 0, seconds * SECOND, { assetId: 'long' })],
      }),
    ])

  it('shows the whole montage however far past the panel it runs', () => {
    // Ten minutes across four hundred pixels: two thirds of a pixel a second, well under the
    // strip's own floor of one. Clamped there, the fit would have shown the first four hundred
    // seconds and called it the whole montage.
    const fitted = programViewport(lasting(600), 400)

    expect(fitted.scale * 600 * SECOND).toBeCloseTo(400, 6)
  })

  it('never fits past the scale a wheel could zoom to', () => {
    // A fifth of a second across a wide panel fits beyond the ceiling; `zoomAt` cannot follow it
    // there, so the first zoom in would have landed BELOW the fit it started at.
    expect(programViewport(lasting(0.2), 1_000).scale).toBe(MAX_SCALE)
  })
})

describe('the envelope of a montage', () => {
  it('smooths the crests into the body of the sound, symmetric about the axis', () => {
    const columns = [
      { x: 0, min: -1, max: 1 },
      { x: 1, min: 0, max: 0 },
      { x: 2, min: 0, max: 0 },
    ]

    const envelope = programEnvelope(columns)

    // A lone transient is averaged down rather than kept: what this line shows is the body of the
    // sound, and the crests it stands under are drawn beside it.
    expect(envelope[0]?.max).toBeCloseTo(1 / 3, 5)
    expect(envelope[0]?.min).toBeCloseTo(-1 / 3, 5)
    expect(envelope.map(column => column.x)).toEqual([0, 1, 2])
  })

  it('never reaches past the crests it averages', () => {
    const columns = Array.from({ length: 20 }, (_unused, x) => ({ x, min: -0.4, max: 0.8 }))

    // Extremes of ±0.4 and ±0.8 average to a reach of 0.6 either side.
    expect(programEnvelope(columns)[10]?.max).toBeCloseTo(0.6, 5)
  })

  it('has nothing to smooth on an empty montage', () => {
    expect(programEnvelope([])).toEqual([])
  })
})

describe('the waveform of a whole montage', () => {
  it('adds up what two tracks put on the same pixel', () => {
    const columns = programColumns(
      montage([sounding('A1', 'a'), sounding('A2', 'b')]),
      () => peaks,
      viewport,
      0,
      200,
    )

    expect(columns[0]).toMatchObject({ x: 0, min: -0.5, max: 0.5 })
  })

  // What is shown follows what is heard, which is the montage's own rule for a muted track.
  it('leaves out a track nothing would play', () => {
    const state = montage([
      { ...sounding('A1', 'a'), muted: true },
      sounding('A2', 'b'),
      { ...sounding('A3', 'c'), muted: true },
    ])

    expect(programColumns(state, () => peaks, viewport, 0, 200)[0]).toMatchObject({ max: 0.25 })
  })

  it('takes the level of a clip into account, that being one the output applies', () => {
    // −6 dB is half the amplitude.
    const state = montage([sounding('A1', 'a', -6.02)])

    expect(programColumns(state, () => peaks, viewport, 0, 200)[0]?.max).toBeCloseTo(0.125, 2)
  })

  // A waveform that has not arrived yet, or an asset that never had one — the rest still draws.
  it('skips a clip with no waveform rather than dropping the montage', () => {
    const state = montage([sounding('A1', 'a'), sounding('A2', 'b')])
    const columns = programColumns(
      state,
      clip => (clip.id === 'a' ? null : peaks),
      viewport,
      0,
      200,
    )

    expect(columns[0]).toMatchObject({ max: 0.25 })
  })

  it('hands its columns back left to right, whatever order the tracks were read in', () => {
    const state = montage([
      makeTrack({
        id: 'A1',
        kind: 'audio',
        index: 0,
        clips: [
          clipFixture('late', 1_000_000, 1_000_000, { assetId: 'late' }),
          clipFixture('early', 0, 1_000_000, { assetId: 'early' }),
        ],
      }),
    ])

    const columns = programColumns(state, () => peaks, viewport, 0, 400)
    expect(columns.map(column => column.x)).toEqual(
      [...columns.map(column => column.x)].sort((a, b) => a - b),
    )
  })
})
