import { describe, expect, it } from 'vitest'
import type { TrackTarget } from '@shared/domain/animation'
import {
  addAnimationTrack,
  armedTracksFor,
  recordMove,
  moveAnimationTrack,
  removeAnimationKey,
  removeAnimationTrack,
  renameAnimationTrack,
  setAnimationKey,
  setTimelineSettings,
} from './animation-commands'
import { EMPTY_SCENE, type SceneState } from './scene-state'

const target = (nodeId: string, property: TrackTarget['property'] = 'position'): TrackTarget => ({
  nodeId,
  property,
})

const vec = (x: number) => ({ x, y: 0, z: 0 })

/** Two tracks, added the way the panel adds them. */
function withTwoTracks(): SceneState {
  const first = addAnimationTrack(target('cube'), 'Cube position', 'track-1').apply(EMPTY_SCENE)
  return addAnimationTrack(target('cube', 'scale'), 'Cube scale', 'track-2').apply(first)
}

const tracksOf = (state: SceneState) => state.animation.tracks

describe('adding and removing tracks', () => {
  it('adds a track at the foot of the stack', () => {
    const state = withTwoTracks()
    expect(tracksOf(state).map(track => track.id)).toEqual(['track-1', 'track-2'])
  })

  it('opens a track with no key, which adds nothing to the pose', () => {
    expect(tracksOf(withTwoTracks())[0]?.keys).toEqual([])
  })

  it('reads row order back from position', () => {
    expect(tracksOf(withTwoTracks()).map(track => track.index)).toEqual([0, 1])
  })

  it('reverts an add by taking the track back out', () => {
    const command = addAnimationTrack(target('cube'), 'Cube', 'track-1')
    expect(command.revert(command.apply(EMPTY_SCENE))).toEqual(EMPTY_SCENE)
  })

  it('keeps the same id across a redo, so nothing that referred to the track loses it', () => {
    const command = addAnimationTrack(target('cube'), 'Cube', 'track-1')
    const once = command.apply(EMPTY_SCENE)
    const again = command.apply(command.revert(once))

    expect(tracksOf(again)[0]?.id).toBe('track-1')
  })

  it('removes a track with the keys it carried, and puts them back on undo', () => {
    const seeded = setAnimationKey('track-1', 1, vec(4)).apply(withTwoTracks())
    const command = removeAnimationTrack('track-1')
    const after = command.apply(seeded)

    expect(tracksOf(after).map(track => track.id)).toEqual(['track-2'])
    expect(tracksOf(command.revert(after))[0]?.keys).toHaveLength(1)
  })

  it('puts a removed track back on the row it was on', () => {
    const command = removeAnimationTrack('track-1')
    const state = withTwoTracks()

    expect(tracksOf(command.revert(command.apply(state))).map(track => track.id)).toEqual([
      'track-1',
      'track-2',
    ])
  })

  it('leaves a locked track alone', () => {
    const state = withTwoTracks()
    const locked: SceneState = {
      ...state,
      animation: {
        ...state.animation,
        tracks: state.animation.tracks.map(track => ({ ...track, locked: true })),
      },
    }

    expect(removeAnimationTrack('track-1').apply(locked)).toEqual(locked)
  })

  it('moves a track down and back up again', () => {
    const command = moveAnimationTrack('track-1', 1)
    const state = withTwoTracks()
    const after = command.apply(state)

    expect(tracksOf(after).map(track => track.id)).toEqual(['track-2', 'track-1'])
    expect(command.revert(after)).toEqual(state)
  })

  it('refuses to move a track off either end', () => {
    const state = withTwoTracks()
    expect(moveAnimationTrack('track-1', -1).apply(state)).toEqual(state)
    expect(moveAnimationTrack('track-2', 1).apply(state)).toEqual(state)
  })

  it('renames a track, and undo gives the old name back', () => {
    const command = renameAnimationTrack('track-1', 'Walk in')
    const state = withTwoTracks()
    const after = command.apply(state)

    expect(tracksOf(after)[0]?.name).toBe('Walk in')
    expect(tracksOf(command.revert(after))[0]?.name).toBe('Cube position')
  })
})

describe('writing keys', () => {
  it('writes a key at an instant and keeps the list sorted', () => {
    const state = setAnimationKey('track-1', 2, vec(9)).apply(
      setAnimationKey('track-1', 1, vec(4)).apply(withTwoTracks()),
    )

    expect(tracksOf(state)[0]?.keys.map(key => key.time)).toEqual([1, 2])
  })

  it('replaces the key standing on that instant rather than adding a second', () => {
    const once = setAnimationKey('track-1', 1, vec(4)).apply(withTwoTracks())
    const twice = setAnimationKey('track-1', 1, vec(7)).apply(once)

    expect(tracksOf(twice)[0]?.keys).toHaveLength(1)
    expect(tracksOf(twice)[0]?.keys[0]?.value.x).toBe(7)
  })

  it('gives the whole list back on undo, not just the key it wrote', () => {
    const seeded = setAnimationKey('track-1', 1, vec(4)).apply(withTwoTracks())
    const command = setAnimationKey('track-1', 1, vec(7))

    expect(command.revert(command.apply(seeded))).toEqual(seeded)
  })

  it('takes a key back out by its instant', () => {
    const seeded = setAnimationKey('track-1', 1, vec(4)).apply(withTwoTracks())
    const after = removeAnimationKey('track-1', 1).apply(seeded)

    expect(tracksOf(after)[0]?.keys).toEqual([])
  })

  it('writes nothing into a locked track', () => {
    const state = withTwoTracks()
    const locked: SceneState = {
      ...state,
      animation: {
        ...state.animation,
        tracks: state.animation.tracks.map(track => ({ ...track, locked: true })),
      },
    }

    expect(setAnimationKey('track-1', 1, vec(4)).apply(locked)).toEqual(locked)
  })

  it('writes nothing into a track that does not exist', () => {
    const state = withTwoTracks()
    expect(setAnimationKey('nobody', 1, vec(4)).apply(state)).toEqual(state)
  })
})

describe('the timeline settings', () => {
  it('changes how long it runs, and undo puts the old length back', () => {
    const command = setTimelineSettings({ duration: 12 })
    const after = command.apply(EMPTY_SCENE)

    expect(after.animation.duration).toBe(12)
    expect(command.revert(after).animation.duration).toBe(EMPTY_SCENE.animation.duration)
  })

  it('changes the frame rate without touching the length', () => {
    const after = setTimelineSettings({ fps: 60 }).apply(EMPTY_SCENE)

    expect(after.animation.fps).toBe(60)
    expect(after.animation.duration).toBe(EMPTY_SCENE.animation.duration)
  })
})

describe('what an armed track catches', () => {
  const rest = { position: vec(1), rotation: vec(0), scale: { x: 2, y: 2, z: 2 } }

  const armed = (state: SceneState, trackId: string): SceneState => ({
    ...state,
    animation: {
      ...state.animation,
      tracks: state.animation.tracks.map(track =>
        track.id === trackId ? { ...track, armed: true } : track,
      ),
    },
  })

  it('names no track while none is armed, so a drag stays a move of the node', () => {
    expect(armedTracksFor(withTwoTracks(), 'cube')).toEqual([])
  })

  it('names the armed track of that node, and never a locked one', () => {
    const state = armed(withTwoTracks(), 'track-1')
    expect(armedTracksFor(state, 'cube').map(track => track.id)).toEqual(['track-1'])
    expect(armedTracksFor(state, 'sphere')).toEqual([])
  })

  it('writes the DIFFERENCE to the rest pose, never the pose itself', () => {
    const state = armed(withTwoTracks(), 'track-1')
    const pose = { ...rest, position: vec(4) }
    const [command] = recordMove(rest, pose, 1, armedTracksFor(state, 'cube'))
    if (!command) throw new Error('one track is armed')

    const after = command.apply(state)
    expect(after.animation.tracks[0]?.keys[0]).toMatchObject({ time: 1, value: vec(3) })
  })

  it('divides a scale back out rather than subtracting it', () => {
    const state = armed(withTwoTracks(), 'track-2')
    const pose = { ...rest, scale: { x: 6, y: 6, z: 6 } }
    const [command] = recordMove(rest, pose, 0, armedTracksFor(state, 'cube'))
    if (!command) throw new Error('one track is armed')

    expect(command.apply(state).animation.tracks[1]?.keys[0]?.value.x).toBe(3)
  })
})

describe('a command asked to revert what it never applied', () => {
  it('leaves the state exactly as it found it', () => {
    const state = withTwoTracks()

    expect(removeAnimationTrack('track-1').revert(state)).toEqual(state)
    expect(moveAnimationTrack('track-1', 1).revert(state)).toEqual(state)
    expect(renameAnimationTrack('track-1', 'x').revert(state)).toEqual(state)
    expect(setAnimationKey('track-1', 1, vec(1)).revert(state)).toEqual(state)
    expect(removeAnimationKey('track-1', 1).revert(state)).toEqual(state)
    expect(setTimelineSettings({ fps: 60 }).revert(state)).toEqual(state)
  })

  it('does nothing for a track no timeline holds', () => {
    const state = withTwoTracks()

    expect(removeAnimationTrack('nobody').apply(state)).toEqual(state)
    expect(moveAnimationTrack('nobody', 1).apply(state)).toEqual(state)
    expect(removeAnimationKey('nobody', 1).apply(state)).toEqual(state)
  })

  it('renames nothing where there is nothing to rename', () => {
    const state = withTwoTracks()
    const command = renameAnimationTrack('nobody', 'x')
    expect(command.revert(command.apply(state))).toEqual(state)
  })
})
