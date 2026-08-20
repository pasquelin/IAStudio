import { describe, expect, it } from 'vitest'
import { redo, run, undo, type History } from '@/engines/core/history'
import { emptyHistory } from '@/engines/core/history'
import { clipFixture, sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import { SECOND } from '@/engines/timeline/timelineState'
import { durationOf, frameCount, rms, toDb, type AudioData } from './audioData'
import {
  chainOf,
  chainsOnMontage,
  clampRegion,
  cropBounds,
  EMPTY_AUDIO_EDIT,
  EMPTY_TAKE_CHAIN,
  parseAudioEdits,
  pushEdit,
  replayEdits,
  takeSliceOf,
  type AudioEdit,
  type AudioEditState,
  type TakeBounds,
  type TakeChain,
  type TakeShape,
} from './edits'
import { encodeWav } from './wav'

const RATE = 100

const tone = (frames: number, level = 0.5): AudioData => ({
  sampleRate: RATE,
  channels: [new Float32Array(frames).fill(level)],
})

/** A block covering the whole of what it was handed — what every take starts out as. */
const whole = (frames: number): TakeBounds => ({
  inPoint: 0,
  duration: Math.round((frames / RATE) * 1_000_000),
})

const render = (source: AudioData, edits: AudioEdit[], start = whole(frameCount(source))) =>
  replayEdits(source, edits, start).data

describe('the edit chain', () => {
  it('leaves the take alone when nothing has been done to it', () => {
    expect(render(tone(100), [])).toEqual(tone(100))
  })

  /**
   * The defect this replaced: a block is a SLICE of the file behind it, and replaying from the
   * whole of that file made every render hand the strip the whole of it back. One gain — which
   * says nothing about bounds — undid a trim laid by hand on the strip.
   */
  it('replays over the block’s slice, never the file behind it', () => {
    const { data, shape } = replayEdits(tone(200, 1), [{ kind: 'gain', db: -6.02 }], {
      inPoint: 500_000,
      duration: 1_000_000,
    })

    expect(frameCount(data)).toBe(100)
    expect(data.channels[0]?.[0]).toBeCloseTo(0.5, 2)
    expect(shape.inPoint).toBe(500_000)
    expect(shape.duration).toBe(1_000_000)
  })

  it('replays from the source, so the same chain always gives the same take', () => {
    const source = tone(200, 1)
    const chain: AudioEdit[] = [{ kind: 'normalize', targetLufs: -20 }]

    expect(render(source, chain).channels[0]?.[0]).toBe(render(source, chain).channels[0]?.[0])
  })

  it('fades from whichever end the step names', () => {
    const rendered = render(tone(100, 1), [{ kind: 'fade', edge: 'out', length: 200_000 }])
    expect(rendered.channels[0]?.[0]).toBe(1)
    expect(rendered.channels[0]?.[99]).toBeCloseTo(0, 1)
  })

  /**
   * The ramps are laid once, at the end, from the lengths the shape came to — where each step
   * used to burn its own in as it arrived. A clip carries one length per edge, so two fades on
   * one edge left the samples holding a curve the strip had no way to describe.
   */
  it('lays one ramp per edge, whatever the chain asked for twice', () => {
    const { data, shape } = replayEdits(
      tone(100, 1),
      [
        { kind: 'fade', edge: 'in', length: 500_000 },
        { kind: 'fade', edge: 'in', length: 200_000 },
      ],
      whole(100),
    )

    expect(shape.fadeIn).toBe(200_000)
    // Past the shorter ramp the take is untouched: the longer one is not burnt in underneath it.
    expect(data.channels[0]?.[30]).toBe(1)
  })
})

/**
 * The bounds of the block, and nothing else. Its ramps and its level are deliberately left out:
 * the chain PRODUCES those two and `writeTakeClip` writes them back, so seeding them here would
 * have every render start from its own last answer — one +3 dB step reading 3, then 6, then 9.
 */
describe('the slice a block shows', () => {
  it('is the block’s own bounds, whatever else the block carries', () => {
    const clip = {
      ...clipFixture('clip-1', 0, 1_000_000, { assetId: 'asset-1' }),
      inPoint: 400_000,
      fadeIn: 100_000,
      gain: -6,
    }

    expect(takeSliceOf(clip)).toEqual({ inPoint: 400_000, duration: 1_000_000 })
  })

  // A clip's duration is TIMELINE time and the samples are SOURCE time, the two differing by the
  // speed it runs at. `writeTakeClip` divides by that same speed on the way back.
  it('reads a duration in source time, whatever speed the block runs at', () => {
    const fast = { ...clipFixture('clip-1', 0, 1_000_000, { assetId: 'asset-1' }), speed: 2 }

    expect(takeSliceOf(fast).duration).toBe(2_000_000)
  })

  // Through `sourceTimeAt`, which rounds: read as a bare multiplication, a fractional speed sent
  // `crop` a duration in fractional microseconds.
  it('answers a whole number of microseconds at a fractional speed', () => {
    const odd = { ...clipFixture('clip-1', 0, 1_000_001, { assetId: 'asset-1' }), speed: 1.1 }

    expect(Number.isInteger(takeSliceOf(odd).duration)).toBe(true)
  })
})

describe('undo', () => {
  const stepsOf = (state: AudioEditState) => chainOf(state, 'clip-1').edits

  it('drops the last step and puts it back', () => {
    let state = EMPTY_AUDIO_EDIT
    let history: History<AudioEditState> = emptyHistory()

    ;[state, history] = run(state, history, pushEdit('clip-1', { kind: 'gain', db: -3 }))
    expect(stepsOf(state)).toHaveLength(1)
    ;[state, history] = undo(state, history)
    expect(stepsOf(state)).toHaveLength(0)
    ;[state] = redo(state, history)
    expect(stepsOf(state)).toHaveLength(1)
  })

  // Two blocks of one montage, each with its own story: an undo on one that reached into the
  // other is the defect a chain held per document could not even express.
  it('walks back the block the step was made on, and leaves its neighbour alone', () => {
    let state = EMPTY_AUDIO_EDIT
    let history: History<AudioEditState> = emptyHistory()

    ;[state, history] = run(
      state,
      history,
      pushEdit('clip-1', { kind: 'normalize', targetLufs: -14 }),
    )
    ;[state, history] = run(state, history, pushEdit('clip-2', { kind: 'gain', db: -3 }))
    ;[state] = undo(state, history)

    expect(chainOf(state, 'clip-2').edits).toEqual([])
    expect(chainOf(state, 'clip-1').edits).toEqual([{ kind: 'normalize', targetLufs: -14 }])
  })

  it('keeps the chain and not the samples, which is what makes it affordable', () => {
    const [state] = run(
      EMPTY_AUDIO_EDIT,
      emptyHistory<AudioEditState>(),
      pushEdit('clip-1', {
        kind: 'normalize',
        targetLufs: -14,
      }),
    )
    expect(stepsOf(state)[0]).toEqual({ kind: 'normalize', targetLufs: -14 })
  })
})

/**
 * A block deleted from the montage leaves its chain behind, on purpose — ⌘Z has to give the
 * block its settings back. The file is where a block is gone for good.
 */
describe('the chains a montage still holds', () => {
  const montage = sequenceWith([trackFixture('A1', 'audio', [clipFixture('clip-a', 0, SECOND)])])

  const state: AudioEditState = {
    chains: {
      'clip-a': { ...EMPTY_TAKE_CHAIN, edits: [{ kind: 'gain', db: -3 }] },
      'clip-gone': { ...EMPTY_TAKE_CHAIN, edits: [{ kind: 'gain', db: 2 }] },
    },
  }

  it('drops the chains of blocks the montage no longer holds', () => {
    expect(Object.keys(chainsOnMontage(state, montage).chains)).toEqual(['clip-a'])
  })

  it('hands back the very same state when every chain still has its block', () => {
    const whole: AudioEditState = {
      chains: { 'clip-a': state.chains['clip-a'] ?? EMPTY_TAKE_CHAIN },
    }
    expect(chainsOnMontage(whole, montage)).toBe(whole)
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
  const chain: TakeChain = {
    edits: [
      { kind: 'fade', edge: 'out', length: 50 },
      { kind: 'gain', db: -3 },
      { kind: 'normalize', targetLufs: -20 },
    ],
    region: { from: 0, to: 200 },
    bypassed: false,
    touched: true,
  }
  const filled: AudioEditState = { chains: { 'clip-a': chain, 'clip-b': EMPTY_TAKE_CHAIN } }

  const stepsIn = (raw: unknown) => chainOf(parseAudioEdits(raw), 'clip-a').edits

  it('survives a serialize/parse round trip unchanged', () => {
    expect(parseAudioEdits(JSON.parse(JSON.stringify(filled)))).toEqual(filled)
  })

  it('falls back to an empty chain rather than throwing on a shape it cannot read', () => {
    expect(parseAudioEdits('not a record')).toEqual(EMPTY_AUDIO_EDIT)
    expect(parseAudioEdits({ chains: 'nope' })).toEqual(EMPTY_AUDIO_EDIT)
  })

  /**
   * A project saved while the chain belonged to the DOCUMENT. Its one chain names the block it
   * was laid down as, and that block is where it now lives — read any other way, every project
   * made before this change would reopen with its fades undone.
   */
  it('gives a chain saved for the whole document to the block it was laid down as', () => {
    const old = {
      assetId: 'asset-a',
      takeClipId: 'clip-a',
      edits: [{ kind: 'gain', db: -3 }],
      region: { from: 0, to: 200 },
    }

    expect(parseAudioEdits(old)).toEqual({
      chains: {
        'clip-a': {
          edits: [{ kind: 'gain', db: -3 }],
          region: { from: 0, to: 200 },
          bypassed: false,
          touched: true,
        },
      },
    })
  })

  // Saved before the montage held the take at all: there is no block to carry it, and the
  // editor now edits blocks. The take itself is an asset and is not lost with it.
  it('drops a chain that names no block, having nowhere to put it', () => {
    expect(parseAudioEdits({ assetId: 'asset-a', edits: [{ kind: 'gain', db: -3 }] })).toEqual(
      EMPTY_AUDIO_EDIT,
    )
  })

  /**
   * Chains saved while cutting was a STEP. Dropped rather than converted, and there is nothing
   * to convert: what they cut to is already in the block's bounds, written there by the very
   * projection that ran on every render. A file saved before the change reopens on the slice it
   * was saved showing.
   */
  it('drops the steps that used to cut, the block already holding where they cut to', () => {
    const raw = {
      chains: {
        'clip-a': {
          edits: [
            { kind: 'crop', from: 10, to: 400 },
            { kind: 'gain', db: 2 },
            { kind: 'trimSilence' },
          ],
        },
      },
    }

    expect(stepsIn(raw)).toEqual([{ kind: 'gain', db: 2 }])
  })

  // A step this build cannot replay is dropped rather than kept as a no-op, which would
  // silently change what the take sounds like.
  it('drops a step of an unknown kind, and a fade naming no edge', () => {
    const raw = {
      chains: {
        'clip-a': {
          edits: [{ kind: 'reverb' }, { kind: 'fade', length: 10 }, { kind: 'gain', db: 2 }],
        },
      },
    }

    expect(stepsIn(raw)).toEqual([{ kind: 'gain', db: 2 }])
  })

  it('drops a region that has collapsed, which every tool would then act on', () => {
    const raw = { chains: { 'clip-a': { region: { from: 5, to: 5 } } } }

    expect(chainOf(parseAudioEdits(raw), 'clip-a').region).toBeNull()
  })

  // A/B is what one is listening to right now; a document reopening on the source would look
  // like a chain that stopped working.
  it('never reopens bypassed', () => {
    const raw = { chains: { 'clip-a': { ...chain, bypassed: true } } }

    expect(chainOf(parseAudioEdits(raw), 'clip-a').bypassed).toBe(false)
  })
})

// The strip has to play what the editor plays, not merely look like it — a clip points at the
// source file, so the chain has to come back out in the source's own coordinates.
describe('the chain read as a montage clip', () => {
  const shapeOf = (source: AudioData, edits: AudioEdit[], start = whole(frameCount(source))) =>
    replayEdits(source, edits, start).shape

  it('hands the block back unchanged when nothing has been done to it', () => {
    const slice: TakeShape = {
      inPoint: 300_000,
      duration: 900_000,
      fadeIn: 0,
      fadeOut: 0,
      gain: 0,
    }

    expect(shapeOf(tone(200), [], slice)).toEqual(slice)
  })

  it('carries a fade to the edge it was laid on', () => {
    const shape = shapeOf(tone(200), [
      { kind: 'fade', edge: 'in', length: 300_000 },
      { kind: 'fade', edge: 'out', length: 100_000 },
    ])

    expect(shape.fadeIn).toBe(300_000)
    expect(shape.fadeOut).toBe(100_000)
  })

  it('adds up the decibels a chain of gains comes to', () => {
    expect(
      shapeOf(tone(100), [
        { kind: 'gain', db: -6 },
        { kind: 'gain', db: 2 },
      ]).gain,
    ).toBe(-4)
  })

  // The one step that cannot be read off its instruction: a level measured on what reaches it.
  it('reads a normalize as the level it actually applied', () => {
    expect(shapeOf(tone(100, 1), [{ kind: 'normalize', targetLufs: -14 }]).gain).toBeCloseTo(-14)
  })

  // No step moves the bounds any more, and that is what makes the chain replayable: seeded from
  // the block it just wrote, a step that cut would eat into its own result on every render.
  it('never moves the bounds, whatever the chain holds', () => {
    const shape = shapeOf(tone(200, 1), [
      { kind: 'normalize', targetLufs: -14 },
      { kind: 'fade', edge: 'in', length: 300_000 },
      { kind: 'gain', db: -3 },
    ])

    expect(shape.inPoint).toBe(0)
    expect(shape.duration).toBe(2_000_000)
  })
})

/**
 * What the two cutting tools land on the block, now that cutting is a montage gesture. Bounds
 * only: a region is measured on the rendered take, which begins where the block begins, and what
 * a cut leaves of a ramp is `clampFades`' answer on the clip.
 */
describe('cutting a slice down to a stretch of itself', () => {
  const slice: TakeBounds = { inPoint: 1_000_000, duration: 2_000_000 }

  it('moves the in point by where the stretch begins', () => {
    expect(cropBounds(slice, 200_000, 900_000)).toEqual({
      inPoint: 1_200_000,
      duration: 700_000,
    })
  })

  it('cannot describe a stretch the samples do not have', () => {
    expect(cropBounds(slice, 0, 9_000_000).duration).toBe(2_000_000)
  })
})
