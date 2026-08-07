import { describe, expect, it } from 'vitest'
import { beginGesture, commandForGesture, snapCandidates } from './interactions'
import { RULER_HEIGHT, type Viewport } from './timeline-geometry'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import type { Clip, SequenceState } from './timeline-state'

const viewport: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

const clip = clipFixture

const stateWith = (clips: Clip[]): SequenceState =>
  sequenceWith([trackFixture('V1', 'video', clips)])

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
    const command = commandForGesture(gesture!, state, viewport, { x: 250, y: RULER_HEIGHT + 30 })
    expect(command!.apply(state).tracks[0]?.clips[0]?.start).toBe(2_000_000)
  })

  it('turns a trim into a trim command', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    const gesture = beginGesture(state, viewport, { x: 98, y: RULER_HEIGHT + 30 })
    const command = commandForGesture(gesture!, state, viewport, { x: 60, y: RULER_HEIGHT + 30 })
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
    const command = commandForGesture(gesture!, state, viewport, { x: 30, y: RULER_HEIGHT + 4 })
    // 300 ms lands between two frames at 25 fps, and a ramp sits on the grid like every edge.
    expect(command!.apply(state).tracks[0]?.clips[0]?.fadeIn).toBe(320_000)
  })

  it('measures a fade out backwards from the clip end', () => {
    const state = stateWith([clip('a', 0, 1_000_000)])
    const gesture = beginGesture(state, viewport, { x: 99, y: RULER_HEIGHT + 4 })
    const command = commandForGesture(gesture!, state, viewport, { x: 80, y: RULER_HEIGHT + 4 })
    expect(command!.apply(state).tracks[0]?.clips[0]?.fadeOut).toBe(200_000)
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
    const gesture = beginGesture(state, viewport, { x: 50, y: RULER_HEIGHT + 30 })
    const command = commandForGesture(gesture!, state, viewport, { x: 400, y: RULER_HEIGHT + 30 })
    const next = command!.apply(state)
    expect(next.tracks[0]?.clips.map(candidate => candidate.id)).toEqual(['b', 'a'])
    expect(next.tracks[0]?.clips[1]?.start).toBe(3_480_000)
  })
})
