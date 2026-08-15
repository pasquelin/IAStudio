import { describe, expect, it } from 'vitest'
import { redo, run, undo, type History } from '@/engines/core/history'
import { emptyHistory } from '@/engines/core/history'
import { durationOf, frameCount, rms, toDb, type AudioData } from './audio-data'
import {
  audibleData,
  clampRegion,
  EMPTY_AUDIO_EDIT,
  parseAudioEdits,
  pushEdit,
  renderEdits,
  replayEdits,
  type AudioEditState,
} from './edits'
import { encodeWav } from './wav'

const RATE = 100

const tone = (frames: number, level = 0.5): AudioData => ({
  sampleRate: RATE,
  channels: [new Float32Array(frames).fill(level)],
})

describe('the edit chain', () => {
  it('leaves the take alone when nothing has been done to it', () => {
    const source = tone(100)
    expect(renderEdits(source, [])).toBe(source)
  })

  it('applies its steps in order', () => {
    const rendered = renderEdits(tone(200, 1), [
      { kind: 'crop', from: 0, to: 1_000_000 },
      { kind: 'gain', db: -6.02 },
    ])

    expect(frameCount(rendered)).toBe(100)
    expect(rendered.channels[0]?.[0]).toBeCloseTo(0.5, 2)
  })

  it('replays from the source, so the same chain always gives the same take', () => {
    const source = tone(200, 1)
    const chain: Parameters<typeof renderEdits>[1] = [{ kind: 'normalize', targetLufs: -20 }]

    expect(renderEdits(source, chain).channels[0]?.[0]).toBe(
      renderEdits(source, chain).channels[0]?.[0],
    )
  })

  it('fades from whichever end the step names', () => {
    const rendered = renderEdits(tone(100, 1), [{ kind: 'fade', edge: 'out', length: 200_000 }])
    expect(rendered.channels[0]?.[0]).toBe(1)
    expect(rendered.channels[0]?.[99]).toBeCloseTo(0, 1)
  })
})

describe('A/B', () => {
  const source = tone(100, 1)
  const state: AudioEditState = {
    ...EMPTY_AUDIO_EDIT,
    edits: [{ kind: 'gain', db: -20 }],
  }

  it('plays the chain by default', () => {
    expect(audibleData(source, state).channels[0]?.[0]).toBeCloseTo(0.1, 1)
  })

  it('plays the source untouched while bypassed, without dropping the chain', () => {
    const bypassed = { ...state, bypassed: true }
    expect(audibleData(source, bypassed)).toBe(source)
    expect(bypassed.edits).toHaveLength(1)
  })
})

describe('undo', () => {
  it('drops the last step and puts it back', () => {
    let state = EMPTY_AUDIO_EDIT
    let history: History<AudioEditState> = emptyHistory()

    ;[state, history] = run(state, history, pushEdit({ kind: 'trimSilence' }))
    expect(state.edits).toHaveLength(1)
    ;[state, history] = undo(state, history)
    expect(state.edits).toHaveLength(0)
    ;[state] = redo(state, history)
    expect(state.edits).toHaveLength(1)
  })

  it('keeps the chain and not the samples, which is what makes it affordable', () => {
    const [state] = run(
      EMPTY_AUDIO_EDIT,
      emptyHistory<AudioEditState>(),
      pushEdit({
        kind: 'normalize',
        targetLufs: -14,
      }),
    )
    expect(state.edits[0]).toEqual({ kind: 'normalize', targetLufs: -14 })
  })
})

describe('regions', () => {
  const data = tone(200)

  it('clamps a region to the take', () => {
    expect(clampRegion({ from: -500, to: 9_000_000 }, data)).toEqual({ from: 0, to: 2_000_000 })
  })

  it('answers nothing for a region that has collapsed', () => {
    expect(clampRegion({ from: 1_000_000, to: 1_000_000 }, data)).toBeNull()
  })
})

describe('writing a wav back', () => {
  it('writes a header a reader can find its way around', () => {
    const bytes = encodeWav(tone(10))
    const view = new DataView(bytes.buffer)
    const ascii = (at: number): string =>
      String.fromCharCode(...[0, 1, 2, 3].map(offset => view.getUint8(at + offset)))

    expect(ascii(0)).toBe('RIFF')
    expect(ascii(8)).toBe('WAVE')
    expect(ascii(36)).toBe('data')
    // Uncompressed PCM, one channel, at the rate it was decoded at.
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(RATE)
  })

  it('writes one 16-bit frame per channel per sample', () => {
    const stereo: AudioData = {
      sampleRate: RATE,
      channels: [new Float32Array(10).fill(0.5), new Float32Array(10).fill(-0.5)],
    }
    expect(encodeWav(stereo).byteLength).toBe(44 + 10 * 2 * 2)
  })

  it('keeps the level it was handed, within a quantisation step', () => {
    const bytes = encodeWav(tone(4, 0.5))
    const view = new DataView(bytes.buffer)
    expect(view.getInt16(44, true) / 0x7fff).toBeCloseTo(0.5, 3)
  })

  it('clamps rather than wrapping a sample past full scale', () => {
    const hot: AudioData = { sampleRate: RATE, channels: [Float32Array.from([2, -2])] }
    const view = new DataView(encodeWav(hot).buffer)
    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
  })

  it('writes an empty take as a header and nothing else', () => {
    expect(encodeWav({ sampleRate: RATE, channels: [new Float32Array()] }).byteLength).toBe(44)
  })

  it('rounds the duration back to what it started as', () => {
    expect(durationOf(tone(150))).toBe(1_500_000)
    expect(toDb(rms(tone(150, 1)))).toBeCloseTo(0)
  })
})

describe('reading an edit chain back', () => {
  const filled: AudioEditState = {
    assetId: 'asset-a',
    edits: [
      { kind: 'crop', from: 10, to: 400 },
      { kind: 'fade', edge: 'out', length: 50 },
      { kind: 'gain', db: -3 },
      { kind: 'normalize', targetLufs: -20 },
      { kind: 'trimSilence' },
    ],
    region: { from: 0, to: 200 },
    bypassed: false,
    takeClipId: 'clip-a',
  }

  it('survives a serialize/parse round trip unchanged', () => {
    expect(parseAudioEdits(JSON.parse(JSON.stringify(filled)))).toEqual(filled)
  })

  it('falls back to an empty chain rather than throwing on a shape it cannot read', () => {
    expect(parseAudioEdits('not a record')).toEqual(EMPTY_AUDIO_EDIT)
    expect(parseAudioEdits({ edits: 'nope' })).toEqual(EMPTY_AUDIO_EDIT)
  })

  // A step this build cannot replay is dropped rather than kept as a no-op, which would
  // silently change what the take sounds like.
  it('drops a step of an unknown kind, and a fade naming no edge', () => {
    const state = parseAudioEdits({
      edits: [{ kind: 'reverb' }, { kind: 'fade', length: 10 }, { kind: 'gain', db: 2 }],
    })
    expect(state.edits).toEqual([{ kind: 'gain', db: 2 }])
  })

  it('drops a crop that spans nothing', () => {
    expect(parseAudioEdits({ edits: [{ kind: 'crop', from: 5, to: 5 }] }).edits).toEqual([])
  })

  it('drops a region that has collapsed, which every tool would then act on', () => {
    expect(parseAudioEdits({ region: { from: 5, to: 5 } }).region).toBeNull()
  })

  it('reads a missing asset id as no take rather than as an empty one', () => {
    expect(parseAudioEdits({ assetId: '' }).assetId).toBeNull()
  })

  // A/B is what one is listening to right now; a document reopening on the source would look
  // like a chain that stopped working.
  it('never reopens bypassed', () => {
    expect(parseAudioEdits({ ...filled, bypassed: true }).bypassed).toBe(false)
  })
})

// The strip has to play what the editor plays, not merely look like it — a clip points at the
// source file, so the chain has to come back out in the source's own coordinates.
describe('the chain read as a montage clip', () => {
  const shapeOf = (source: AudioData, edits: Parameters<typeof replayEdits>[1]) =>
    replayEdits(source, edits).shape

  it('is the whole take when nothing has been done to it', () => {
    expect(shapeOf(tone(200), [])).toEqual({
      inPoint: 0,
      duration: 2_000_000,
      fadeIn: 0,
      fadeOut: 0,
      gain: 0,
    })
  })

  // Each crop measures against what reaches it; the shape has to answer in source time, so the
  // second one's offset is added to the first's rather than replacing it.
  it('composes two crops back into one slice of the source', () => {
    const shape = shapeOf(tone(200), [
      { kind: 'crop', from: 500_000, to: 1_500_000 },
      { kind: 'crop', from: 200_000, to: 700_000 },
    ])

    expect(shape.inPoint).toBe(700_000)
    expect(shape.duration).toBe(500_000)
  })

  it('carries a fade to the edge it was laid on', () => {
    const shape = shapeOf(tone(200), [
      { kind: 'fade', edge: 'in', length: 300_000 },
      { kind: 'fade', edge: 'out', length: 100_000 },
    ])

    expect(shape.fadeIn).toBe(300_000)
    expect(shape.fadeOut).toBe(100_000)
  })

  // The documented limit of the projection: a clip holds one ramp length per edge, so what it
  // can say of a ramp cut into is what is left of it.
  it('keeps only what a later crop leaves of a ramp', () => {
    const shape = shapeOf(tone(200), [
      { kind: 'fade', edge: 'in', length: 500_000 },
      { kind: 'crop', from: 200_000, to: 2_000_000 },
    ])

    expect(shape.fadeIn).toBe(300_000)
  })

  it('adds up the decibels a chain of gains comes to', () => {
    expect(
      shapeOf(tone(100), [
        { kind: 'gain', db: -6 },
        { kind: 'gain', db: 2 },
      ]).gain,
    ).toBe(-4)
  })

  // Neither of these two can be read off the instruction: one is a level measured on what
  // reaches it, the other a pair of bounds found in the samples.
  it('reads a normalize as the level it actually applied', () => {
    expect(shapeOf(tone(100, 1), [{ kind: 'normalize', targetLufs: -14 }]).gain).toBeCloseTo(-14)
  })

  it('reads a silence trim as the bounds it actually found', () => {
    const quiet = new Float32Array(200)
    quiet.fill(0.5, 50, 150)
    const shape = shapeOf({ sampleRate: RATE, channels: [quiet] }, [{ kind: 'trimSilence' }])

    expect(shape.inPoint).toBe(500_000)
    expect(shape.duration).toBe(1_000_000)
  })
})
