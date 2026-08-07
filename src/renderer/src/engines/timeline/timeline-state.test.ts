import { describe, expect, it } from 'vitest'
import {
  clipEnd,
  clipById,
  deserializeSequence,
  EMPTY_SEQUENCE,
  frameDuration,
  insertClip,
  newClipId,
  sequenceDuration,
  serializeSequence,
  snapToFrame,
  trackOfClip,
  wholeFrames,
  type Clip,
  type SequenceState,
  type Track,
} from './timeline-state'

/** Insertion takes the tail's id from its caller, so the tests can name it and read it back. */
const TAIL = 'tail-1'

const clip = (id: string, start: number, duration: number): Clip => ({
  id,
  assetId: `asset-${id}`,
  start,
  duration,
  inPoint: 0,
  speed: 1,
})

const track = (clips: Clip[]): Track => ({
  id: 'V1',
  kind: 'video',
  index: 0,
  muted: false,
  locked: false,
  clips,
})

describe('sequence state', () => {
  it('opens on one video track and one audio track, both empty', () => {
    expect(EMPTY_SEQUENCE.tracks).toHaveLength(2)
    expect(EMPTY_SEQUENCE.tracks.every(candidate => candidate.clips.length === 0)).toBe(true)
    expect(EMPTY_SEQUENCE.playhead).toBe(0)
  })

  it('derives a frame duration from the frame rate', () => {
    expect(frameDuration({ width: 1920, height: 1080, fps: 25, sampleRate: 48000 })).toBe(40_000)
  })

  it('snaps a time to the nearest frame boundary', () => {
    const settings = { width: 1920, height: 1080, fps: 25, sampleRate: 48000 }
    expect(snapToFrame(39_999, settings)).toBe(40_000)
    expect(snapToFrame(41_000, settings)).toBe(40_000)
    expect(snapToFrame(-10, settings)).toBe(0)
  })

  it('rounds a duration to a whole number of frames', () => {
    const settings = { width: 1920, height: 1080, fps: 25, sampleRate: 48000 }
    expect(wholeFrames(3_510_000, settings)).toBe(3_520_000)
    expect(wholeFrames(480_000, settings)).toBe(480_000)
  })

  it('never rounds a duration down to nothing', () => {
    const settings = { width: 1920, height: 1080, fps: 25, sampleRate: 48000 }
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
    const next = insertClip(target, clip('b', 0, 1_000), TAIL)
    expect(next.clips.map(candidate => candidate.id)).toEqual(['b', 'a'])
  })

  it('trims the neighbour an inserted clip overlaps on its tail', () => {
    const target = track([clip('a', 0, 2_000)])
    const next = insertClip(target, clip('b', 1_000, 2_000), TAIL)
    expect(next.clips[0]).toMatchObject({ id: 'a', start: 0, duration: 1_000 })
    expect(next.clips[1]).toMatchObject({ id: 'b', start: 1_000 })
  })

  it('trims the neighbour an inserted clip overlaps on its head, moving its in point', () => {
    const target = track([{ ...clip('a', 1_000, 2_000), inPoint: 500 }])
    const next = insertClip(target, clip('b', 0, 1_500), TAIL)
    expect(next.clips[1]).toMatchObject({ id: 'a', start: 1_500, duration: 1_500, inPoint: 1_000 })
  })

  it('drops a neighbour an inserted clip covers entirely', () => {
    const target = track([clip('a', 500, 500)])
    const next = insertClip(target, clip('b', 0, 2_000), TAIL)
    expect(next.clips.map(candidate => candidate.id)).toEqual(['b'])
  })

  it('splits a neighbour an inserted clip lands inside, naming the tail as asked', () => {
    const target = track([clip('a', 0, 3_000)])
    const next = insertClip(target, clip('b', 1_000, 1_000), TAIL)
    expect(next.clips.map(candidate => candidate.id)).toEqual(['a', 'b', TAIL])
    expect(next.clips[2]).toMatchObject({ start: 2_000, duration: 1_000, inPoint: 2_000 })
  })

  it('mints an id nothing else carries, which is what a cut clip needs', () => {
    expect(newClipId()).not.toBe(newClipId())
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

  it('survives a serialize/deserialize round trip unchanged', () => {
    const state: SequenceState = { ...EMPTY_SEQUENCE, tracks: [track([clip('a', 0, 1_000)])] }
    expect(deserializeSequence(serializeSequence(state))).toEqual(state)
  })

  it('falls back to an empty sequence rather than throwing on unreadable input', () => {
    expect(deserializeSequence('{ not json')).toEqual(EMPTY_SEQUENCE)
    expect(deserializeSequence('{"tracks":"nope"}')).toEqual(EMPTY_SEQUENCE)
  })
})
