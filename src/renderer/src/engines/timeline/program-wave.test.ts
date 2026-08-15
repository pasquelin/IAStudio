import { describe, expect, it } from 'vitest'
import { PEAKS_PER_SECOND } from '@shared/domain/asset'
import { paintProgram, programColumns } from './program-wave'
import type { Viewport } from './timeline-geometry'
import { clipFixture } from './timeline-fixtures'
import { EMPTY_SOUND_SEQUENCE, makeTrack, type SequenceState } from './timeline-state'

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
  const painted = (): { labels: string[]; context: CanvasRenderingContext2D } => {
    const labels: string[] = []
    const context = {
      fillRect: () => {},
      fillText: (text: string) => labels.push(text),
      set fillStyle(_ink: string) {},
      set font(_font: string) {},
      set textBaseline(_baseline: string) {},
      // `as`: what a ruler asks of a 2D context is these five members, and jsdom builds none.
      // The take is left without peaks on purpose — the wave is `paintWaveform`'s own suite.
    } as unknown as CanvasRenderingContext2D

    return { labels, context }
  }

  const style = { background: 'a', tick: 'b', text: 'c', font: '10px monospace' }

  it('graduates the time across its width', () => {
    const { labels, context } = painted()

    paintProgram(
      context,
      montage([sounding('A1', 'a')]),
      () => null,
      { width: 400, height: 120 },
      { wave: 'w', playhead: 'p', background: 'bg', ruler: style },
    )

    expect(labels.length).toBeGreaterThan(0)
    // A timecode, not a bare number of microseconds: the same reading as the strip's.
    expect(labels[0]).toMatch(/^\d\d:\d\d:\d\d/)
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
