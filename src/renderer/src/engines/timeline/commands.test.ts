import { describe, expect, it } from 'vitest'
import { addClip, moveClip, removeClip, splitClip, trimClip } from './commands'
import { EMPTY_SEQUENCE, type Clip, type SequenceState } from './timeline-state'

const clip = (id: string, start: number, duration: number): Clip => ({
  id,
  assetId: `asset-${id}`,
  start,
  duration,
  inPoint: 0,
  speed: 1,
})

const withClips = (clips: Clip[], locked = false): SequenceState => ({
  ...EMPTY_SEQUENCE,
  tracks: [
    { id: 'V1', kind: 'video', index: 1, muted: false, locked, clips },
    { id: 'V2', kind: 'video', index: 2, muted: false, locked: false, clips: [] },
  ],
})

describe('sequence commands', () => {
  it('adds a clip and selects it', () => {
    const command = addClip('V1', clip('a', 0, 1_000))
    const next = command.apply(withClips([]))
    expect(next.tracks[0]?.clips).toHaveLength(1)
    expect(next.selectedId).toBe('a')
  })

  it('reverts an add by removing the clip again', () => {
    const command = addClip('V1', clip('a', 0, 1_000))
    const state = withClips([])
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('leaves a locked track untouched', () => {
    const command = addClip('V1', clip('a', 0, 1_000))
    const state = withClips([], true)
    expect(command.apply(state)).toEqual(state)
  })

  it('moves a clip to another track at a snapped position', () => {
    const command = moveClip('a', 'V2', 41_000)
    const next = command.apply(withClips([clip('a', 0, 1_000)]))
    expect(next.tracks[0]?.clips).toHaveLength(0)
    expect(next.tracks[1]?.clips[0]).toMatchObject({ id: 'a', start: 40_000 })
  })

  it('reverts a move back to the original track and position', () => {
    const command = moveClip('a', 'V2', 41_000)
    const state = withClips([clip('a', 0, 1_000)])
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('trims the out edge', () => {
    const command = trimClip('a', 'out', 600_000)
    const next = command.apply(withClips([clip('a', 0, 1_000_000)]))
    expect(next.tracks[0]?.clips[0]).toMatchObject({ start: 0, duration: 600_000, inPoint: 0 })
  })

  it('trims the in edge, moving both start and in point', () => {
    const command = trimClip('a', 'in', 200_000)
    const next = command.apply(withClips([clip('a', 0, 1_000_000)]))
    expect(next.tracks[0]?.clips[0]).toMatchObject({
      start: 200_000,
      duration: 800_000,
      inPoint: 200_000,
    })
  })

  it('refuses a trim that would leave nothing rather than clamping it to zero', () => {
    const state = withClips([clip('a', 0, 1_000_000)])
    expect(trimClip('a', 'out', 0).apply(state)).toEqual(state)
    expect(trimClip('a', 'in', 1_000_000).apply(state)).toEqual(state)
  })

  it('splits a clip in two, the second one starting later in the source', () => {
    const next = splitClip('a', 400_000).apply(withClips([clip('a', 0, 1_000_000)]))
    expect(next.tracks[0]?.clips).toHaveLength(2)
    expect(next.tracks[0]?.clips[0]).toMatchObject({ start: 0, duration: 400_000, inPoint: 0 })
    expect(next.tracks[0]?.clips[1]).toMatchObject({
      start: 400_000,
      duration: 600_000,
      inPoint: 400_000,
    })
  })

  it('gives each insertion its own tail id, so two drops on one neighbour stay distinct', () => {
    const first = addClip('V1', clip('b', 1_000, 1_000)).apply(withClips([clip('a', 0, 3_000)]))
    const second = addClip('V1', clip('c', 200, 400)).apply(first)
    const ids = second.tracks[0]?.clips.map(candidate => candidate.id) ?? []

    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
  })

  it('gives each cut its own tail id, so cutting the same clip twice keeps ids distinct', () => {
    const once = splitClip('a', 2_000_000).apply(withClips([clip('a', 0, 4_000_000)]))
    const twice = splitClip('a', 1_000_000).apply(once)
    const ids = twice.tracks[0]?.clips.map(candidate => candidate.id) ?? []

    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
  })

  it('keeps the tail id stable across a redo, so nothing points at a clip that moved', () => {
    const command = splitClip('a', 400_000)
    const state = withClips([clip('a', 0, 1_000_000)])
    const first = command.apply(state)
    const again = command.apply(command.revert(first))

    expect(again.tracks[0]?.clips[1]?.id).toBe(first.tracks[0]?.clips[1]?.id)
  })

  it('refuses a split on an exact edge, which would produce an empty clip', () => {
    const state = withClips([clip('a', 0, 1_000_000)])
    expect(splitClip('a', 0).apply(state)).toEqual(state)
    expect(splitClip('a', 1_000_000).apply(state)).toEqual(state)
  })

  it('reverts a split by restoring the single clip', () => {
    const command = splitClip('a', 400_000)
    const state = withClips([clip('a', 0, 1_000_000)])
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('reverts a removal at the original index', () => {
    const command = removeClip('a')
    const state = withClips([clip('a', 0, 1_000), clip('b', 2_000, 1_000)])
    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('restores the previous selection when an add is reverted', () => {
    const state = { ...withClips([clip('b', 0, 1_000)]), selectedId: 'b' }
    const command = addClip('V1', clip('a', 5_000, 1_000))
    expect(command.revert(command.apply(state)).selectedId).toBe('b')
  })
})
