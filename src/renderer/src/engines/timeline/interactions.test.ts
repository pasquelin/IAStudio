import { describe, expect, it } from 'vitest'
import { beginGesture, commandForGesture, snapCandidates } from './interactions'
import { RULER_HEIGHT, TRACK_HEIGHT, type Point, type Viewport } from './timeline-geometry'
import { EMPTY_SEQUENCE, trackOfClip, type Clip, type SequenceState } from './timeline-state'

const viewport: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

const clip = (id: string, start: number, duration: number): Clip => ({
  id,
  assetId: `asset-${id}`,
  start,
  duration,
  inPoint: 0,
  speed: 1,
})

const stateWith = (clips: Clip[]): SequenceState => ({
  ...EMPTY_SEQUENCE,
  tracks: [{ id: 'V1', kind: 'video', index: 1, muted: false, locked: false, clips }],
})

const twoTracks = (clips: Clip[], secondLocked = false): SequenceState => {
  const state = stateWith(clips)
  return {
    ...state,
    tracks: [
      ...state.tracks,
      { id: 'V2', kind: 'video', index: 2, muted: false, locked: secondLocked, clips: [] },
    ],
  }
}

/** Grab point of every drag below: the middle of a clip starting at zero. */
const GRAB: Point = { x: 50, y: RULER_HEIGHT + 10 }

const dragTo = (state: SequenceState, to: Point): SequenceState => {
  const gesture = beginGesture(state, viewport, GRAB)
  return commandForGesture(gesture!, state, viewport, to)!.apply(state)
}

describe('timeline interactions', () => {
  it('begins a drag on a clip body', () => {
    const gesture = beginGesture(stateWith([clip('a', 0, 1_000_000)]), viewport, {
      x: 50,
      y: RULER_HEIGHT + 10,
    })
    expect(gesture).toMatchObject({ kind: 'drag', clipId: 'a', grabOffset: 500_000 })
  })

  it('begins a trim on a clip edge', () => {
    const gesture = beginGesture(stateWith([clip('a', 0, 1_000_000)]), viewport, {
      x: 98,
      y: RULER_HEIGHT + 10,
    })
    expect(gesture).toMatchObject({ kind: 'trim', clipId: 'a', edge: 'out' })
  })

  it('begins a scrub on the ruler', () => {
    expect(beginGesture(stateWith([]), viewport, { x: 50, y: 4 })).toEqual({ kind: 'scrub' })
  })

  it('begins nothing on empty track space', () => {
    expect(beginGesture(stateWith([]), viewport, { x: 50, y: RULER_HEIGHT + 10 })).toBeNull()
  })

  it('turns a drag into a move command that keeps the grab offset', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    const gesture = beginGesture(state, viewport, { x: 50, y: RULER_HEIGHT + 10 })
    const command = commandForGesture(gesture!, state, viewport, { x: 250, y: RULER_HEIGHT + 10 })
    expect(command!.apply(state).tracks[0]?.clips[0]?.start).toBe(2_000_000)
  })

  it('drops a dragged clip on the track under the pointer, not the one it left', () => {
    const state = twoTracks([clip('a', 0, 1_000_000)])
    const next = dragTo(state, { x: 250, y: RULER_HEIGHT + TRACK_HEIGHT + 10 })

    expect(trackOfClip(next, 'a')?.id).toBe('V2')
  })

  it('refuses to drop on a locked track, leaving the clip where it started', () => {
    const state = twoTracks([clip('a', 0, 1_000_000)], true)
    const next = dragTo(state, { x: 250, y: RULER_HEIGHT + TRACK_HEIGHT + 10 })

    expect(trackOfClip(next, 'a')?.id).toBe('V1')
    expect(next.tracks[0]?.clips[0]?.start).toBe(2_000_000)
  })

  it('refuses to drop a video clip on an audio track, where its picture would vanish', () => {
    const state: SequenceState = {
      ...EMPTY_SEQUENCE,
      tracks: [
        {
          id: 'V1',
          kind: 'video',
          index: 1,
          muted: false,
          locked: false,
          clips: [clip('a', 0, 1_000_000)],
        },
        { id: 'A1', kind: 'audio', index: 0, muted: false, locked: false, clips: [] },
      ],
    }
    const next = dragTo(state, { x: 250, y: RULER_HEIGHT + TRACK_HEIGHT + 10 })

    expect(trackOfClip(next, 'a')?.id).toBe('V1')
  })

  it('keeps the clip on its own track when the pointer leaves the tracks entirely', () => {
    const state = twoTracks([clip('a', 0, 1_000_000)])

    expect(trackOfClip(dragTo(state, { x: 250, y: 4 }), 'a')?.id).toBe('V1')
  })

  it('turns a trim into a trim command', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    const gesture = beginGesture(state, viewport, { x: 98, y: RULER_HEIGHT + 10 })
    const command = commandForGesture(gesture!, state, viewport, { x: 60, y: RULER_HEIGHT + 10 })
    expect(command!.apply(state).tracks[0]?.clips[0]?.duration).toBe(600_000)
  })

  it('produces no command for a scrub, which is not an edit', () => {
    const state = stateWith([])
    expect(commandForGesture({ kind: 'scrub' }, state, viewport, { x: 60, y: 4 })).toBeNull()
  })

  it('offers neighbour edges and the playhead as snap candidates, minus the dragged clip', () => {
    const state = stateWith([clip('a', 0, 1_000_000), clip('b', 2_000_000, 500_000)])
    expect(snapCandidates(state, 'a')).toEqual([2_000_000, 2_500_000, 0])
  })

  it('sticks a dragged clip to a neighbour edge, butt-joining it', () => {
    // 480 ms is twelve whole frames at 25 fps. A duration that is not a whole number of frames
    // puts the neighbour's tail off the grid, and the command realigns it — leaving a gap.
    const state = stateWith([clip('a', 0, 1_000_000), clip('b', 3_000_000, 480_000)])
    const gesture = beginGesture(state, viewport, { x: 50, y: RULER_HEIGHT + 10 })
    const command = commandForGesture(gesture!, state, viewport, { x: 400, y: RULER_HEIGHT + 10 })
    const next = command!.apply(state)
    expect(next.tracks[0]?.clips.map(candidate => candidate.id)).toEqual(['b', 'a'])
    expect(next.tracks[0]?.clips[1]?.start).toBe(3_480_000)
  })
})
