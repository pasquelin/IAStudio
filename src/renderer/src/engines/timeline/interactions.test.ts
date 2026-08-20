import { describe, expect, it } from 'vitest'
import {
  beginGesture,
  commandForGesture,
  snapCandidates,
  viewportForGesture,
  type Gesture,
  type MediaExtents,
} from './interactions'
import { RULER_HEIGHT, type Viewport } from './timelineGeometry'
import type { Point } from '../core/geometry'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import { DEFAULT_TRACK_HEIGHT, trackOfClip, type Clip, type SequenceState } from './timelineState'

const viewport: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

const clip = clipFixture

const stateWith = (clips: Clip[]): SequenceState =>
  sequenceWith([trackFixture('V1', 'video', clips)])

const twoTracks = (clips: Clip[], secondLocked = false): SequenceState => {
  const state = stateWith(clips)
  return {
    ...state,
    tracks: [...state.tracks, trackFixture('V2', 'video', [], { index: 2, locked: secondLocked })],
  }
}

/** Grab point of every drag below: the middle of a clip starting at zero. */
const GRAB: Point = { x: 50, y: RULER_HEIGHT + 10 }

/** No media bound here — how a trim reads its own is covered in `commands.test.ts`. */
const TIMELESS: MediaExtents = () => 'still'

const commandFor = (gesture: Gesture, state: SequenceState, to: Point) =>
  commandForGesture(gesture, state, viewport, to, TIMELESS)

const dragTo = (state: SequenceState, to: Point): SequenceState => {
  const gesture = beginGesture(state, viewport, GRAB)
  return commandFor(gesture!, state, to)!.apply(state)
}

describe('timeline interactions', () => {
  it('begins a drag on a clip body', () => {
    const gesture = beginGesture(stateWith([clip('a', 0, 1_000_000)]), viewport, {
      x: 50,
      y: RULER_HEIGHT + 30,
    })
    expect(gesture).toMatchObject({ kind: 'drag', clipId: 'a', grabOffset: 500_000 })
  })

  it('begins a trim on a clip edge', () => {
    const gesture = beginGesture(stateWith([clip('a', 0, 1_000_000)]), viewport, {
      x: 98,
      y: RULER_HEIGHT + 30,
    })
    expect(gesture).toMatchObject({ kind: 'trim', clipId: 'a', edge: 'out' })
  })

  it('begins a scrub on the ruler', () => {
    expect(beginGesture(stateWith([]), viewport, { x: 50, y: 4 })).toEqual({ kind: 'scrub' })
  })

  it('begins nothing on empty track space', () => {
    expect(beginGesture(stateWith([]), viewport, { x: 50, y: RULER_HEIGHT + 30 })).toBeNull()
  })

  it('turns a drag into a move command that keeps the grab offset', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    const gesture = beginGesture(state, viewport, { x: 50, y: RULER_HEIGHT + 30 })
    const command = commandFor(gesture!, state, { x: 250, y: RULER_HEIGHT + 30 })
    expect(command!.apply(state).tracks[0]?.clips[0]?.start).toBe(2_000_000)
  })

  it('drops a dragged clip on the track under the pointer, not the one it left', () => {
    const state = twoTracks([clip('a', 0, 1_000_000)])
    const next = dragTo(state, { x: 250, y: RULER_HEIGHT + DEFAULT_TRACK_HEIGHT + 10 })

    expect(trackOfClip(next, 'a')?.id).toBe('V2')
  })

  it('refuses to drop on a locked track, leaving the clip where it started', () => {
    const state = twoTracks([clip('a', 0, 1_000_000)], true)
    const next = dragTo(state, { x: 250, y: RULER_HEIGHT + DEFAULT_TRACK_HEIGHT + 10 })

    expect(trackOfClip(next, 'a')?.id).toBe('V1')
    expect(next.tracks[0]?.clips[0]?.start).toBe(2_000_000)
  })

  it('refuses to drop a video clip on an audio track, where its picture would vanish', () => {
    const state = sequenceWith([
      trackFixture('V1', 'video', [clip('a', 0, 1_000_000)]),
      trackFixture('A1', 'audio'),
    ])
    const next = dragTo(state, { x: 250, y: RULER_HEIGHT + DEFAULT_TRACK_HEIGHT + 10 })

    expect(trackOfClip(next, 'a')?.id).toBe('V1')
  })

  it('keeps the clip on its own track when the pointer leaves the tracks entirely', () => {
    const state = twoTracks([clip('a', 0, 1_000_000)])

    expect(trackOfClip(dragTo(state, { x: 250, y: 4 }), 'a')?.id).toBe('V1')
  })

  it('turns a trim into a trim command', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    const gesture = beginGesture(state, viewport, { x: 98, y: RULER_HEIGHT + 30 })
    const command = commandFor(gesture!, state, { x: 60, y: RULER_HEIGHT + 30 })
    expect(command!.apply(state).tracks[0]?.clips[0]?.duration).toBe(600_000)
  })

  it('begins a fade along the top of a clip, where the trim would take the same corner lower', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    expect(beginGesture(state, viewport, { x: 2, y: RULER_HEIGHT + 4 })).toMatchObject({
      kind: 'fade',
      clipId: 'a',
      edge: 'in',
    })
  })

  it('turns a fade drag into the ramp length it was dragged to', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    const gesture = beginGesture(state, viewport, { x: 2, y: RULER_HEIGHT + 4 })
    const command = commandFor(gesture!, state, { x: 30, y: RULER_HEIGHT + 4 })
    // 300 ms lands between two frames at 25 fps, and a ramp sits on the grid like every edge.
    expect(command!.apply(state).tracks[0]?.clips[0]?.fadeIn).toBe(320_000)
  })

  it('measures a fade out backwards from the clip end', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    const gesture = beginGesture(state, viewport, { x: 99, y: RULER_HEIGHT + 4 })
    const command = commandFor(gesture!, state, { x: 80, y: RULER_HEIGHT + 4 })
    expect(command!.apply(state).tracks[0]?.clips[0]?.fadeOut).toBe(200_000)
  })

  it('produces no command for a scrub, which is not an edit', () => {
    const state = stateWith([])
    expect(commandFor({ kind: 'scrub' }, state, { x: 60, y: 4 })).toBeNull()
  })

  it('offers neighbour edges and the playhead as snap candidates, minus the dragged clip', () => {
    const state = stateWith([clip('a', 0, 1_000_000), clip('b', 2_000_000, 500_000)])
    expect(snapCandidates(state, 'a')).toEqual([2_000_000, 2_500_000, 0])
  })

  it('sticks a dragged clip to a neighbour edge, butt-joining it', () => {
    // 480 ms is twelve whole frames at 25 fps. A duration that is not a whole number of frames
    // puts the neighbour's tail off the grid, and the command realigns it — leaving a gap.
    const state = stateWith([clip('a', 0, 1_000_000), clip('b', 3_000_000, 480_000)])
    const gesture = beginGesture(state, viewport, { x: 50, y: RULER_HEIGHT + 30 })
    const command = commandFor(gesture!, state, { x: 400, y: RULER_HEIGHT + 30 })
    const next = command!.apply(state)
    expect(next.tracks[0]?.clips.map(candidate => candidate.id)).toEqual(['b', 'a'])
    expect(next.tracks[0]?.clips[1]?.start).toBe(3_480_000)
  })
})

describe('panning the view', () => {
  const state = stateWith([clip('a', 0, 1_000_000)])

  // The hand takes the press wherever it lands: over a clip, over a gap, over the ruler.
  it('begins a pan over a clip rather than dragging it', () => {
    const gesture = beginGesture(state, viewport, { x: 50, y: RULER_HEIGHT + 30 }, true)
    expect(gesture).toMatchObject({ kind: 'pan', from: { x: 50 }, base: viewport })
  })

  it('begins one over empty space, where an edit gesture answers nothing at all', () => {
    expect(
      beginGesture(stateWith([]), viewport, { x: 50, y: RULER_HEIGHT + 30 }, true),
    ).toMatchObject({ kind: 'pan' })
  })

  // Measured from the grab, not from the previous frame: accumulated deltas drift, and the
  // strip has to sit exactly where the hand put it.
  it('moves the view against the pointer, from where the grab started', () => {
    const gesture = beginGesture(state, viewport, { x: 300, y: RULER_HEIGHT + 30 }, true)
    const moved = viewportForGesture(gesture!, { x: 100, y: RULER_HEIGHT + 30 })

    expect(moved?.offset).toBe(Math.round(200 / viewport.scale))
  })

  it('edits nothing while it pans', () => {
    const gesture = beginGesture(state, viewport, { x: 50, y: RULER_HEIGHT + 30 }, true)
    expect(commandFor(gesture!, state, { x: 200, y: RULER_HEIGHT + 30 })).toBeNull()
  })

  it('leaves the view alone for every gesture that is not a pan', () => {
    expect(viewportForGesture({ kind: 'scrub' }, { x: 10, y: 10 })).toBeNull()
  })
})
