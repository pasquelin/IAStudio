import { describe, expect, it } from 'vitest'
import {
  clampFades,
  clampTrackHeight,
  clipEnd,
  clipById,
  DEFAULT_TRACK_HEIGHT,
  deserializeSequence,
  EMPTY_SEQUENCE,
  fadeGainAt,
  frameDuration,
  insertClip,
  makeClip,
  makeTrack,
  MAX_TRACK_HEIGHT,
  MIN_TRACK_HEIGHT,
  playsThrough,
  sequenceDuration,
  serializeSequence,
  snapToFrame,
  trackOfClip,
  wholeFrames,
  type Clip,
  type SequenceState,
  type Track,
} from './timeline-state'

const clip = (id: string, start: number, duration: number): Clip =>
  makeClip({ id, assetId: `asset-${id}`, start, duration })

const track = (clips: Clip[]): Track => makeTrack({ id: 'V1', kind: 'video', index: 0, clips })

const settings = { width: 1920, height: 1080, fps: 25, sampleRate: 48000 }

describe('sequence state', () => {
  it('opens on one video track and one audio track, both empty', () => {
    expect(EMPTY_SEQUENCE.tracks).toHaveLength(2)
    expect(EMPTY_SEQUENCE.tracks.every(candidate => candidate.clips.length === 0)).toBe(true)
    expect(EMPTY_SEQUENCE.playhead).toBe(0)
  })

  it('names a track after its id until it is renamed', () => {
    expect(EMPTY_SEQUENCE.tracks.map(candidate => candidate.name)).toEqual(['V1', 'A1'])
  })

  it('derives a frame duration from the frame rate', () => {
    expect(frameDuration(settings)).toBe(40_000)
  })

  it('snaps a time to the nearest frame boundary', () => {
    expect(snapToFrame(39_999, settings)).toBe(40_000)
    expect(snapToFrame(41_000, settings)).toBe(40_000)
    expect(snapToFrame(-10, settings)).toBe(0)
  })

  it('rounds a duration to a whole number of frames', () => {
    expect(wholeFrames(3_510_000, settings)).toBe(3_520_000)
    expect(wholeFrames(480_000, settings)).toBe(480_000)
  })

  it('never rounds a duration down to nothing', () => {
    expect(wholeFrames(1_000, settings)).toBe(40_000)
  })

  it('finds a clip and its track by clip id', () => {
    const state: SequenceState = { ...EMPTY_SEQUENCE, tracks: [track([clip('a', 0, 1_000)])] }
    expect(clipById(state, 'a')?.duration).toBe(1_000)
    expect(trackOfClip(state, 'a')?.id).toBe('V1')
    expect(clipById(state, 'nope')).toBeNull()
  })

  it('keeps clips sorted by start when inserting', () => {
    const target = track([clip('a', 2_000, 1_000)])
    const next = insertClip(target, clip('b', 0, 1_000))
    expect(next.clips.map(candidate => candidate.id)).toEqual(['b', 'a'])
  })

  it('trims the neighbour an inserted clip overlaps on its tail', () => {
    const target = track([clip('a', 0, 2_000)])
    const next = insertClip(target, clip('b', 1_000, 2_000))
    expect(next.clips[0]).toMatchObject({ id: 'a', start: 0, duration: 1_000 })
    expect(next.clips[1]).toMatchObject({ id: 'b', start: 1_000 })
  })

  it('trims the neighbour an inserted clip overlaps on its head, moving its in point', () => {
    const target = track([{ ...clip('a', 1_000, 2_000), inPoint: 500 }])
    const next = insertClip(target, clip('b', 0, 1_500))
    expect(next.clips[1]).toMatchObject({ id: 'a', start: 1_500, duration: 1_500, inPoint: 1_000 })
  })

  it('drops a neighbour an inserted clip covers entirely', () => {
    const target = track([clip('a', 500, 500)])
    const next = insertClip(target, clip('b', 0, 2_000))
    expect(next.clips.map(candidate => candidate.id)).toEqual(['b'])
  })

  it('splits a neighbour an inserted clip lands inside', () => {
    const target = track([clip('a', 0, 3_000)])
    const next = insertClip(target, clip('b', 1_000, 1_000))
    // The tail is a new clip and needs its own id: two clips sharing one would break every
    // lookup by id, starting with selection.
    expect(next.clips.map(candidate => candidate.id)).toEqual(['a', 'b', 'a-tail'])
    expect(next.clips[2]).toMatchObject({ start: 2_000, duration: 1_000, inPoint: 2_000 })
  })

  it('shortens the fades of a neighbour an insertion trimmed', () => {
    const long = { ...clip('a', 0, 2_000), fadeIn: 1_500 }
    const next = insertClip(track([long]), clip('b', 500, 1_500))
    expect(next.clips[0]).toMatchObject({ id: 'a', duration: 500, fadeIn: 500 })
  })

  it('ends where the last clip of any track ends', () => {
    const state: SequenceState = {
      ...EMPTY_SEQUENCE,
      tracks: [track([clip('a', 0, 1_000)]), { ...track([clip('b', 5_000, 2_000)]), id: 'A1' }],
    }
    expect(sequenceDuration(state)).toBe(7_000)
  })

  it('lasts nothing while it holds no clip', () => {
    expect(sequenceDuration(EMPTY_SEQUENCE)).toBe(0)
  })

  it('computes the end of a clip from its start and duration', () => {
    expect(clipEnd(clip('a', 1_000, 500))).toBe(1_500)
  })
})

describe('clip defaults', () => {
  it('gives a new clip untouched fades, gain and speed', () => {
    expect(makeClip({ id: 'a', assetId: 'asset', start: 0, duration: 1_000 })).toMatchObject({
      inPoint: 0,
      speed: 1,
      fadeIn: 0,
      fadeOut: 0,
      gain: 0,
    })
  })

  it('lets an explicit value win over the default', () => {
    expect(makeClip({ id: 'a', assetId: 'asset', start: 0, duration: 1_000, gain: -6 }).gain).toBe(
      -6,
    )
  })

  it('gives a new track the default height and no solo', () => {
    expect(makeTrack({ id: 'A2', kind: 'audio', index: 0 })).toMatchObject({
      name: 'A2',
      height: DEFAULT_TRACK_HEIGHT,
      solo: false,
      muted: false,
      locked: false,
      clips: [],
    })
  })
})

describe('fades', () => {
  it('leaves fades that fit alone, and shares nothing it does not have to', () => {
    const fitting = { ...clip('a', 0, 1_000), fadeIn: 200, fadeOut: 300 }
    expect(clampFades(fitting)).toBe(fitting)
  })

  it('caps a fade at the clip it belongs to', () => {
    expect(clampFades({ ...clip('a', 0, 1_000), fadeIn: 4_000 })).toMatchObject({ fadeIn: 1_000 })
  })

  it('never lets two fades overlap, which would raise the middle instead of lowering the ends', () => {
    const crossed = clampFades({ ...clip('a', 0, 1_000), fadeIn: 800, fadeOut: 800 })
    expect(crossed.fadeIn + crossed.fadeOut).toBeLessThanOrEqual(1_000)
    expect(crossed).toMatchObject({ fadeIn: 800, fadeOut: 200 })
  })

  it('rises across the fade in and falls across the fade out', () => {
    const faded = { ...clip('a', 0, 1_000), fadeIn: 200, fadeOut: 200 }
    expect(fadeGainAt(faded, 0)).toBe(0)
    expect(fadeGainAt(faded, 100)).toBeCloseTo(0.5)
    expect(fadeGainAt(faded, 500)).toBe(1)
    expect(fadeGainAt(faded, 900)).toBeCloseTo(0.5)
    expect(fadeGainAt(faded, 1_000)).toBe(0)
  })

  it('stays at full level across a clip with no fades', () => {
    expect(fadeGainAt(clip('a', 0, 1_000), 500)).toBe(1)
  })

  it('is silent outside the clip', () => {
    const faded = { ...clip('a', 1_000, 1_000), fadeIn: 200, fadeOut: 200 }
    expect(fadeGainAt(faded, 500)).toBe(0)
    expect(fadeGainAt(faded, 2_500)).toBe(0)
  })
})

describe('mute and solo', () => {
  const audio = makeTrack({ id: 'A1', kind: 'audio', index: 0 })
  const video = makeTrack({ id: 'V1', kind: 'video', index: 1 })

  it('lets every unmuted track through while nothing is soloed', () => {
    const state: SequenceState = { ...EMPTY_SEQUENCE, tracks: [audio, video] }
    expect(state.tracks.every(candidate => playsThrough(state, candidate))).toBe(true)
  })

  it('silences a muted track', () => {
    const muted = { ...audio, muted: true }
    const state: SequenceState = { ...EMPTY_SEQUENCE, tracks: [muted, video] }
    expect(playsThrough(state, muted)).toBe(false)
  })

  it('silences every track that is not soloed once one is', () => {
    const soloed = { ...audio, solo: true }
    const state: SequenceState = { ...EMPTY_SEQUENCE, tracks: [soloed, video] }
    expect(playsThrough(state, soloed)).toBe(true)
    expect(playsThrough(state, video)).toBe(false)
  })

  it('keeps a muted track silent even when it is soloed', () => {
    const both = { ...audio, solo: true, muted: true }
    const state: SequenceState = { ...EMPTY_SEQUENCE, tracks: [both] }
    expect(playsThrough(state, both)).toBe(false)
  })
})

describe('track height', () => {
  it('clamps to the readable range', () => {
    expect(clampTrackHeight(4)).toBe(MIN_TRACK_HEIGHT)
    expect(clampTrackHeight(10_000)).toBe(MAX_TRACK_HEIGHT)
    expect(clampTrackHeight(72.4)).toBe(72)
  })
})

describe('reading a sequence back', () => {
  it('survives a serialize/deserialize round trip unchanged', () => {
    const state: SequenceState = { ...EMPTY_SEQUENCE, tracks: [track([clip('a', 0, 1_000)])] }
    expect(deserializeSequence(serializeSequence(state))).toEqual(state)
  })

  it('falls back to an empty sequence rather than throwing on unreadable input', () => {
    expect(deserializeSequence('{ not json')).toEqual(EMPTY_SEQUENCE)
    expect(deserializeSequence('{"tracks":"nope"}')).toEqual(EMPTY_SEQUENCE)
  })

  it('fills in what a version written before fades and heights left out', () => {
    const older = JSON.stringify({
      settings: { width: 1920, height: 1080, fps: 25, sampleRate: 48_000 },
      tracks: [
        {
          id: 'A1',
          kind: 'audio',
          index: 0,
          muted: false,
          locked: false,
          clips: [{ id: 'a', assetId: 'asset-a', start: 0, duration: 1_000, inPoint: 0, speed: 1 }],
        },
      ],
      playhead: 0,
    })

    const [restored] = deserializeSequence(older).tracks
    expect(restored).toMatchObject({ name: 'A1', height: DEFAULT_TRACK_HEIGHT, solo: false })
    expect(restored?.clips[0]).toMatchObject({ fadeIn: 0, fadeOut: 0, gain: 0 })
  })

  it('drops a clip with no source, no identity or no length rather than drawing nothing', () => {
    const broken = JSON.stringify({
      tracks: [
        {
          id: 'V1',
          kind: 'video',
          clips: [
            { id: 'a', assetId: 'asset-a', start: 0, duration: 1_000 },
            { id: 'b', assetId: '', start: 0, duration: 1_000 },
            { id: 'c', assetId: 'asset-c', start: 0, duration: 0 },
          ],
        },
      ],
    })

    expect(deserializeSequence(broken).tracks[0]?.clips.map(candidate => candidate.id)).toEqual([
      'a',
    ])
  })

  it('rebuilds a track whose stored clips overlap, because every later edit assumes they do not', () => {
    const overlapping = JSON.stringify({
      tracks: [
        {
          id: 'V1',
          kind: 'video',
          clips: [
            { id: 'a', assetId: 'asset-a', start: 0, duration: 2_000 },
            { id: 'b', assetId: 'asset-b', start: 1_000, duration: 2_000 },
          ],
        },
      ],
    })

    const [restored] = deserializeSequence(overlapping).tracks
    expect(restored?.clips).toMatchObject([
      { id: 'a', start: 0, duration: 1_000 },
      { id: 'b', start: 1_000, duration: 2_000 },
    ])
  })

  it('refuses a frame rate of zero, which would divide by zero on every snap', () => {
    const zero = JSON.stringify({
      settings: { width: 1920, height: 1080, fps: 0, sampleRate: 0 },
      tracks: [{ id: 'V1', kind: 'video', clips: [] }],
    })
    expect(deserializeSequence(zero).settings).toMatchObject({ fps: 25, sampleRate: 48_000 })
  })

  it('forgets a selection pointing at a clip the read discarded', () => {
    const stale = JSON.stringify({
      tracks: [{ id: 'V1', kind: 'video', clips: [] }],
      selectedId: 'gone',
    })
    expect(deserializeSequence(stale).selectedId).toBeNull()
  })
})
