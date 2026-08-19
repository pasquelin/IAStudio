import { describe, expect, it, vi } from 'vitest'
import type { AudioData } from '../audio/audioData'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import { SECOND } from './timelineState'
import { stemsOf } from './stems'

const RATE = 48_000

/** A rush of `seconds` at a steady level, so what a ramp did to it is readable in one sample. */
const flat = (level: number, seconds = 4, channels = 1): AudioData => ({
  sampleRate: RATE,
  channels: Array.from({ length: channels }, () => new Float32Array(seconds * RATE).fill(level)),
})

const from = (byAsset: Record<string, AudioData>) => (assetId: string) =>
  Promise.resolve(byAsset[assetId] ?? null)

const at = (stem: Float32Array, seconds: number): number => stem[Math.round(seconds * RATE)] ?? 0

describe('a montage mixed down to its stems', () => {
  it('lands a clip where the timeline puts it, and leaves the rest silent', async () => {
    const state = sequenceWith([
      trackFixture('A1', 'audio', [clipFixture('a', 2 * SECOND, 2 * SECOND)]),
    ])

    const [stem] = await stemsOf(state, from({ 'asset-a': flat(0.5) }))

    const samples = stem?.data.channels[0] ?? new Float32Array(0)
    expect(at(samples, 0.5)).toBe(0)
    expect(at(samples, 3)).toBeCloseTo(0.5, 3)
  })

  /** The entry point inside the rush, which is what a trim is: the head reads from there, not zero. */
  it('reads the rush from the clip’s own entry point', async () => {
    const rising = {
      sampleRate: RATE,
      channels: [Float32Array.from({ length: 4 * RATE }, (_unused, frame) => frame / RATE / 4)],
    }
    const state = sequenceWith([
      trackFixture('A1', 'audio', [clipFixture('a', 0, SECOND, { inPoint: 2 * SECOND })]),
    ])

    const [stem] = await stemsOf(state, from({ 'asset-a': rising }))

    // Two seconds into a four-second ramp is half of it, and that is what frame zero must hold.
    expect(at(stem?.data.channels[0] ?? new Float32Array(0), 0)).toBeCloseTo(0.5, 2)
  })

  /**
   * The very `fadeAt` the scheduler plays through and the painter draws. A stem whose ramps came
   * from a second spelling would sound unlike the strip that was judged.
   */
  it('rides the clip’s own ramps rather than a second spelling of them', async () => {
    const state = sequenceWith([
      trackFixture('A1', 'audio', [
        clipFixture('a', 0, 4 * SECOND, { fadeIn: 2 * SECOND, fadeOut: 2 * SECOND }),
      ]),
    ])

    const [stem] = await stemsOf(state, from({ 'asset-a': flat(1) }))

    const samples = stem?.data.channels[0] ?? new Float32Array(0)
    expect(at(samples, 1)).toBeCloseTo(0.5, 2)
    expect(at(samples, 2)).toBeCloseTo(1, 2)
    expect(at(samples, 3)).toBeCloseTo(0.5, 2)
  })

  it('lowers a clip by the decibels it carries', async () => {
    const state = sequenceWith([
      trackFixture('A1', 'audio', [clipFixture('a', 0, 2 * SECOND, { gain: -6 })]),
    ])

    const [stem] = await stemsOf(state, from({ 'asset-a': flat(1) }))

    // -6 dB is very nearly half the amplitude, which is the number a mixer's own scale shows.
    expect(at(stem?.data.channels[0] ?? new Float32Array(0), 1)).toBeCloseTo(0.501, 2)
  })

  /** Two clips over one another are a sum, not a replacement — the second must not erase the first. */
  it('sums two tracks’ worth of clips into their own stems, never into one', async () => {
    const state = sequenceWith([
      trackFixture('A1', 'audio', [clipFixture('a', 0, 2 * SECOND)]),
      trackFixture('A2', 'audio', [clipFixture('b', 0, 2 * SECOND)]),
    ])

    const stems = await stemsOf(state, from({ 'asset-a': flat(0.5), 'asset-b': flat(0.25) }))

    expect(stems.map(one => one.trackId)).toEqual(['A1', 'A2'])
    expect(at(stems[0]?.data.channels[0] ?? new Float32Array(0), 1)).toBeCloseTo(0.5, 3)
    expect(at(stems[1]?.data.channels[0] ?? new Float32Array(0), 1)).toBeCloseTo(0.25, 3)
  })

  /**
   * `playsThrough` decides it, which is the answer the scheduler gives — a stem set that held a
   * muted track would be a mix nobody has ever heard.
   */
  it('leaves out a track the montage does not play', async () => {
    const state = sequenceWith([
      trackFixture('A1', 'audio', [clipFixture('a', 0, SECOND)], { muted: true }),
      trackFixture('A2', 'audio', [clipFixture('b', 0, SECOND)]),
    ])

    const stems = await stemsOf(state, from({ 'asset-a': flat(1), 'asset-b': flat(1) }))

    expect(stems.map(one => one.trackId)).toEqual(['A2'])
  })

  it('writes no stem for a video track, which carries no sound to write', async () => {
    const state = sequenceWith([trackFixture('V1', 'video', [clipFixture('a', 0, SECOND)])])

    expect(await stemsOf(state, from({ 'asset-a': flat(1) }))).toEqual([])
  })

  /** Thirty laughs of the same jingle are one file, and decoding it thirty times is minutes. */
  it('decodes each rush once however many clips point at it', async () => {
    const decode = vi.fn(() => Promise.resolve(flat(1)))
    const state = sequenceWith([
      trackFixture('A1', 'audio', [
        clipFixture('a', 0, SECOND, { assetId: 'asset-a' }),
        clipFixture('b', SECOND, SECOND, { assetId: 'asset-a' }),
      ]),
    ])

    await stemsOf(state, decode)

    expect(decode).toHaveBeenCalledTimes(1)
  })

  /** A rush that will not open costs its clip, never the whole mix. */
  it('mixes what did decode when one rush cannot be read', async () => {
    const state = sequenceWith([
      trackFixture('A1', 'audio', [
        clipFixture('gone', 0, SECOND),
        clipFixture('b', SECOND, SECOND),
      ]),
    ])

    const [stem] = await stemsOf(state, from({ 'asset-b': flat(0.5) }))

    const samples = stem?.data.channels[0] ?? new Float32Array(0)
    expect(at(samples, 0.5)).toBe(0)
    expect(at(samples, 1.5)).toBeCloseTo(0.5, 3)
  })

  /**
   * A stereo take folded to mono would lose a width somebody placed, and a `.wav` has nowhere to
   * say it was folded.
   */
  it('keeps a track as wide as its widest rush', async () => {
    const state = sequenceWith([
      trackFixture('A1', 'audio', [
        clipFixture('a', 0, SECOND, { assetId: 'mono' }),
        clipFixture('b', SECOND, SECOND, { assetId: 'stereo' }),
      ]),
    ])

    const [stem] = await stemsOf(state, from({ mono: flat(1, 4, 1), stereo: flat(0.5, 4, 2) }))

    expect(stem?.data.channels).toHaveLength(2)
    // The mono rush reaches BOTH channels rather than only the left one.
    expect(at(stem?.data.channels[1] ?? new Float32Array(0), 0.5)).toBeCloseTo(1, 3)
  })

  it('stops where it was asked to, rather than mixing a montage nobody is waiting for', async () => {
    const state = sequenceWith([trackFixture('A1', 'audio', [clipFixture('a', 0, SECOND)])])

    await expect(
      stemsOf(state, from({ 'asset-a': flat(1) }), { signal: AbortSignal.abort() }),
    ).rejects.toThrow()
  })

  it('reports its progress, so a long montage moves a bar rather than freezing', async () => {
    const onStep = vi.fn()
    const state = sequenceWith([
      trackFixture('A1', 'audio', [clipFixture('a', 0, SECOND), clipFixture('b', SECOND, SECOND)]),
    ])

    await stemsOf(state, from({ 'asset-a': flat(1), 'asset-b': flat(1) }), { onStep })

    expect(onStep.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ])
  })
})
