import { describe, expect, it } from 'vitest'
import type { TrackTarget } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { fovAt, poseAt } from './animationEval'
import {
  addAnimationTrack,
  addCameraShot,
  editCameraShot,
  lensToCommand,
  recordingTracksFor,
  removeCameraShot,
  keyNode,
  keySubject,
  moveAnimationKey,
  movesToCommand,
  reorderCameraShots,
  railOnNewShot,
  recordMove,
  removeAnimationKey,
  removeAnimationTrack,
  setAnimationKey,
  setTimelineSettings,
  updateAnimationTrack,
} from './animationCommands'
import { cameraShot } from './animation-fixtures'
import { cameraNodeFixture } from './scene-fixtures'
import { EMPTY_SCENE, IDENTITY_TRANSFORM, type SceneNode, type SceneState } from './sceneState'

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
        track.id === trackId ? { ...track, locked: true } : track,
      ),
    },
  })

  it('names every channel of that node, and no other node', () => {
    const state = withTwoTracks()
    expect(recordingTracksFor(state, 'cube').map(track => track.id)).toEqual(['track-1', 'track-2'])
    expect(recordingTracksFor(state, 'sphere')).toEqual([])
  })

  it('leaves a locked channel out, so a padlock still refuses a drag', () => {
    const state = armed(withTwoTracks(), 'track-1')
    expect(recordingTracksFor(state, 'cube').map(track => track.id)).toEqual(['track-2'])
  })

  it('keeps a bone apart from the node that carries it', () => {
    const boned = addAnimationTrack(
      { nodeId: 'cube', bone: 'Hips', property: 'position' },
      'Cube Hips',
      'track-bone',
    ).apply(withTwoTracks())

    expect(recordingTracksFor(boned, 'cube').map(track => track.id)).toEqual(['track-1', 'track-2'])
    // And a bone IS reachable now, which is what the pose mode needed.
    expect(recordingTracksFor(boned, 'cube', 'Hips').map(track => track.id)).toEqual(['track-bone'])
  })

  it('writes the DIFFERENCE to the rest pose, never the pose itself', () => {
    const state = withTwoTracks()
    const pose = { ...rest, position: vec(4) }
    const [command] = recordMove(rest, pose, 1, recordingTracksFor(state, 'cube').slice(0, 1))
    if (!command) throw new Error('one channel is recording')

    const after = command.apply(state)
    expect(after.animation.tracks[0]?.keys[0]).toMatchObject({ time: 1, value: vec(3) })
  })

  it('divides a scale back out rather than subtracting it', () => {
    const state = withTwoTracks()
    const pose = { ...rest, scale: { x: 6, y: 6, z: 6 } }
    const [command] = recordMove(rest, pose, 0, recordingTracksFor(state, 'cube').slice(1))
    if (!command) throw new Error('one channel is recording')

    expect(command.apply(state).animation.tracks[1]?.keys[0]?.value.x).toBe(3)
  })
})

describe('a command asked to revert what it never applied', () => {
  it('leaves the state exactly as it found it', () => {
    const state = withTwoTracks()

    expect(removeAnimationTrack('track-1').revert(state)).toEqual(state)
    expect(setAnimationKey('track-1', 1, vec(1)).revert(state)).toEqual(state)
    expect(removeAnimationKey('track-1', 1).revert(state)).toEqual(state)
    expect(setTimelineSettings({ fps: 60 }).revert(state)).toEqual(state)
  })

  it('does nothing for a track no timeline holds', () => {
    const state = withTwoTracks()

    expect(removeAnimationTrack('nobody').apply(state)).toEqual(state)
    expect(removeAnimationKey('nobody', 1).apply(state)).toEqual(state)
  })
})

describe('what one drag becomes over a whole selection', () => {
  const rest = { position: vec(0), rotation: vec(0), scale: { x: 1, y: 1, z: 1 } }
  const node = (id: string): SceneNode => ({
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: rest,
    castShadow: false,
    receiveShadow: false,
    type: 'group',
  })

  const sceneWith = (): SceneState =>
    addAnimationTrack(target('cube'), 'Cube position', 'track-1').apply({
      ...EMPTY_SCENE,
      nodes: [node('cube'), node('sphere')],
    })

  const moved = (id: string, x: number) => ({ id, transform: { ...rest, position: vec(x) } })

  it('moves the nodes themselves while auto-key is off', () => {
    const state = sceneWith()
    const command = movesToCommand(state, [moved('cube', 5)], 0, false)
    if (!command) throw new Error('one node moved')

    const after = command.apply(state)
    expect(after.nodes[0]?.transform.position.x).toBe(5)
    expect(after.animation.tracks[0]?.keys).toEqual([])
  })

  it('writes a key instead once auto-key is recording', () => {
    const state = sceneWith()
    const command = movesToCommand(state, [moved('cube', 5)], 1, true)
    if (!command) throw new Error('one node moved')

    const after = command.apply(state)
    expect(after.animation.tracks[0]?.keys[0]).toMatchObject({ time: 1, value: vec(5) })
    // The node itself never moved: that is the whole point of recording.
    expect(after.nodes[0]?.transform.position.x).toBe(0)
  })

  it('is ONE command over a mixed selection, so one drag is one undo', () => {
    const state = sceneWith()
    const command = movesToCommand(state, [moved('cube', 5), moved('sphere', 9)], 0, true)
    if (!command) throw new Error('two nodes moved')

    const after = command.apply(state)
    expect(after.animation.tracks[0]?.keys).toHaveLength(1)
    expect(after.nodes[1]?.transform.position.x).toBe(9)
    // And it reverts as one, which a pair of commands could not promise.
    expect(command.revert(after)).toEqual(state)
  })

  it('answers nothing when there is nothing to write', () => {
    expect(movesToCommand(sceneWith(), [], 0, false)).toBeNull()
  })
})

describe('keying a whole subject at once', () => {
  it('writes on every channel, so one press keys move, turn and size together', () => {
    const state = withTwoTracks()
    const command = keySubject(state, ['track-1', 'track-2'], 2 * SECOND)
    if (!command) throw new Error('two tracks were given')

    const after = command.apply(state)
    expect(tracksOf(after)[0]?.keys).toHaveLength(1)
    expect(tracksOf(after)[1]?.keys).toHaveLength(1)
  })

  it('holds each channel at the value it ALREADY stands at, never at a neutral', () => {
    // A scale track keyed with nothing on it must hold one, not zero — zero would flatten it.
    const state = withTwoTracks()
    const command = keySubject(state, ['track-2'], 0)
    if (!command) throw new Error('one track was given')

    expect(command.apply(state).animation.tracks[1]?.keys[0]?.value).toEqual({ x: 1, y: 1, z: 1 })
  })

  it('pins the interpolated pose when it lands between two keys', () => {
    const keyed = setAnimationKey('track-1', 0, vec(0)).apply(withTwoTracks())
    const spanned = setAnimationKey('track-1', 4 * SECOND, vec(8)).apply(keyed)

    const command = keySubject(spanned, ['track-1'], 2 * SECOND)
    if (!command) throw new Error('one track was given')

    const written = command.apply(spanned).animation.tracks[0]?.keys
    expect(written?.find(key => key.time === 2 * SECOND)?.value.x).toBeCloseTo(4, 5)
  })

  it('reverts as ONE entry, so a key costs one undo and not three', () => {
    const state = withTwoTracks()
    const command = keySubject(state, ['track-1', 'track-2'], SECOND)
    if (!command) throw new Error('two tracks were given')

    expect(command.revert(command.apply(state))).toEqual(state)
  })

  it('skips a locked channel rather than refusing the whole press', () => {
    const state = updateAnimationTrack(withTwoTracks(), 'track-1', track => ({
      ...track,
      locked: true,
    }))
    const command = keySubject(state, ['track-1', 'track-2'], 0)
    if (!command) throw new Error('one channel is still writable')

    const after = command.apply(state)
    expect(tracksOf(after)[0]?.keys).toHaveLength(0)
    expect(tracksOf(after)[1]?.keys).toHaveLength(1)
  })

  it('answers nothing when no channel can take a key', () => {
    expect(keySubject(withTwoTracks(), [], 0)).toBeNull()
    expect(keySubject(withTwoTracks(), ['nowhere'], 0)).toBeNull()
  })
})

describe('sliding a key along its track', () => {
  it('carries the value to the new instant', () => {
    const state = setAnimationKey('track-1', SECOND, vec(7)).apply(withTwoTracks())
    const after = moveAnimationKey('track-1', SECOND, 3 * SECOND).apply(state)

    expect(tracksOf(after)[0]?.keys).toEqual([{ time: 3 * SECOND, value: vec(7) }])
  })

  it('replaces a key already standing where it lands', () => {
    const one = setAnimationKey('track-1', 0, vec(1)).apply(withTwoTracks())
    const two = setAnimationKey('track-1', 2 * SECOND, vec(9)).apply(one)

    const after = moveAnimationKey('track-1', 0, 2 * SECOND).apply(two)
    expect(tracksOf(after)[0]?.keys).toEqual([{ time: 2 * SECOND, value: vec(1) }])
  })

  it('leaves the track alone when nothing stands at the instant given', () => {
    const state = setAnimationKey('track-1', SECOND, vec(7)).apply(withTwoTracks())
    expect(moveAnimationKey('track-1', 9 * SECOND, 0).apply(state)).toBe(state)
  })

  it('refuses to move a key of a locked track', () => {
    const keyed = setAnimationKey('track-1', SECOND, vec(7)).apply(withTwoTracks())
    const locked = updateAnimationTrack(keyed, 'track-1', track => ({ ...track, locked: true }))

    expect(moveAnimationKey('track-1', SECOND, 0).apply(locked)).toBe(locked)
  })

  it('puts the key back where it was', () => {
    const state = setAnimationKey('track-1', SECOND, vec(7)).apply(withTwoTracks())
    const command = moveAnimationKey('track-1', SECOND, 3 * SECOND)

    expect(command.revert(command.apply(state))).toEqual(state)
  })
})

describe('keying an object that was moved by hand', () => {
  const REST = { position: vec(0), rotation: vec(0), scale: { x: 1, y: 1, z: 1 } }
  const cube = (x: number): SceneNode => ({
    id: 'cube',
    parentId: null,
    name: 'cube',
    visible: true,
    transform: { ...REST, position: vec(x) },
    castShadow: false,
    receiveShadow: false,
    type: 'group',
  })

  /** The gesture that showed nothing: key, move the object, key again, press Play. */
  const cubeAt = (x: number): SceneState => ({ ...EMPTY_SCENE, nodes: [cube(x)] })

  const keyAt = (state: SceneState, time: number): SceneState => {
    const command = keyNode(state, { nodeId: 'cube' }, time, NAMES, property => `t-${property}`)
    if (!command) throw new Error('a node is always keyable')
    return command.apply(state)
  }

  const NAMES = {
    position: 'Cube · Position',
    rotation: 'Cube · Rotation',
    scale: 'Cube · Scale',
    fov: 'Cube · Lens',
  }

  it('holds the movement made since the channel opened, not zero', () => {
    const first = keyAt(cubeAt(0), 0)
    // The object is dragged with nothing recording, which writes its POSITION.
    const dragged = {
      ...first,
      nodes: [{ ...first.nodes[0]!, transform: { ...REST, position: vec(4) } }],
    }

    const second = keyAt(dragged, 2 * SECOND)
    const position = second.animation.tracks.find(track => track.target.property === 'position')

    expect(position?.keys.map(key => key.value.x)).toEqual([0, 4])
  })

  it('puts the object back on its rest pose, so the move is counted ONCE', () => {
    const first = keyAt(cubeAt(0), 0)
    const dragged = {
      ...first,
      nodes: [{ ...first.nodes[0]!, transform: { ...REST, position: vec(4) } }],
    }

    const second = keyAt(dragged, 2 * SECOND)

    // Left at four, the viewport would show four PLUS the key's four at the second key.
    expect(second.nodes[0]?.transform.position.x).toBe(0)
  })

  it('makes the two keys describe an actual movement, which is what Play shows', () => {
    const first = keyAt(cubeAt(0), 0)
    const dragged = {
      ...first,
      nodes: [{ ...first.nodes[0]!, transform: { ...REST, position: vec(4) } }],
    }
    const second = keyAt(dragged, 2 * SECOND)

    const at = (time: number) =>
      poseAt(second.nodes[0]!.transform, second.animation, 'cube', time).position.x

    expect(at(0)).toBe(0)
    expect(at(1 * SECOND)).toBeCloseTo(2, 5)
    expect(at(2 * SECOND)).toBe(4)
  })

  it('reverts the whole thing — keys, channels and the pose — in one go', () => {
    const state = cubeAt(0)
    const command = keyNode(state, { nodeId: 'cube' }, 0, NAMES, property => `t-${property}`)
    if (!command) throw new Error('a node is always keyable')

    expect(command.revert(command.apply(state))).toEqual(state)
  })
})

describe('dragging an object that is already keyed', () => {
  const REST = { position: vec(0), rotation: vec(0), scale: { x: 1, y: 1, z: 1 } }
  const cube = (x: number): SceneNode => ({
    id: 'cube',
    parentId: null,
    name: 'cube',
    visible: true,
    transform: { ...REST, position: vec(x) },
    castShadow: false,
    receiveShadow: false,
    type: 'group',
  })

  const NAMES = {
    position: 'Cube · Position',
    rotation: 'Cube · Rotation',
    scale: 'Cube · Scale',
    fov: 'Cube · Lens',
  }

  /** A cube keyed at zero and again at two seconds, four units along. */
  function animated(): SceneState {
    const start = { ...EMPTY_SCENE, nodes: [cube(0)] }
    const first = keyNode(start, { nodeId: 'cube' }, 0, NAMES, p => `t-${p}`)?.apply(start)
    if (!first) throw new Error('a node is always keyable')

    const dragged = { ...first, nodes: [cube(4)] }
    return keyNode(dragged, { nodeId: 'cube' }, 2 * SECOND, NAMES, p => `t-${p}`)!.apply(dragged)
  }

  const poseOf = (state: SceneState, time: number) =>
    poseAt(state.nodes[0]!.transform, state.animation, 'cube', time).position.x

  it('records the drag even with the switch OFF, since the object is already animated', () => {
    const state = animated()
    // Dropped at nine, at the instant the second key stands on.
    const command = movesToCommand(
      state,
      [{ id: 'cube', transform: { ...REST, position: vec(9) } }],
      2 * SECOND,
      false,
    )
    if (!command) throw new Error('one node moved')

    // Where it was dropped, not nine plus the four the key already added.
    expect(poseOf(command.apply(state), 2 * SECOND)).toBe(9)
  })

  it('leaves the earlier key where it was, so one drag edits one instant', () => {
    const state = animated()
    const command = movesToCommand(
      state,
      [{ id: 'cube', transform: { ...REST, position: vec(9) } }],
      2 * SECOND,
      false,
    )

    expect(poseOf(command!.apply(state), 0)).toBe(0)
  })

  it('still moves an UNKEYED object rather than keying it behind your back', () => {
    const plain = { ...EMPTY_SCENE, nodes: [cube(0)] }
    const command = movesToCommand(
      plain,
      [{ id: 'cube', transform: { ...REST, position: vec(5) } }],
      0,
      false,
    )

    const after = command!.apply(plain)
    expect(after.nodes[0]?.transform.position.x).toBe(5)
    expect(after.animation.tracks).toEqual([])
  })

  it('records an object whose channels exist but hold no key only when asked', () => {
    const start = { ...EMPTY_SCENE, nodes: [cube(0)] }
    const opened = addAnimationTrack(target('cube'), 'Cube position', 'track-1').apply(start)
    const move = [{ id: 'cube', transform: { ...REST, position: vec(5) } }]

    // Empty channels are not an animation yet: the switch still decides.
    expect(
      movesToCommand(opened, move, 0, false)!.apply(opened).nodes[0]?.transform.position.x,
    ).toBe(5)
    expect(
      movesToCommand(opened, move, 0, true)!.apply(opened).nodes[0]?.transform.position.x,
    ).toBe(0)
  })
})

describe('the lens of a camera, typed into the inspector', () => {
  const camera = cameraNodeFixture('cam', { fov: 50 })
  const plain: SceneState = { ...EMPTY_SCENE, nodes: [camera] }
  const lensed = addAnimationTrack(target('cam', 'fov'), 'Camera lens', 'lens').apply(plain)

  const descriptorFov = (state: SceneState): number | null => {
    const node = state.nodes[0]
    return node?.type === 'camera' ? node.camera.fov : null
  }
  const keysOf = (state: SceneState) => state.animation.tracks[0]?.keys ?? []

  it('writes the descriptor for a camera no lens channel drives', () => {
    expect(descriptorFov(lensToCommand(plain, [camera], 80, 0, true).apply(plain))).toBe(80)
  })

  it('writes what the channel must ADD, leaving the descriptor where it stands', () => {
    const applied = lensToCommand(lensed, [camera], 80, 0, true).apply(lensed)

    expect(keysOf(applied)).toEqual([{ time: 0, value: { x: 30, y: 0, z: 0 } }])
    expect(descriptorFov(applied)).toBe(50)
  })

  it('leaves an empty channel alone while nothing records', () => {
    const applied = lensToCommand(lensed, [camera], 80, 0, false).apply(lensed)

    expect(keysOf(applied)).toEqual([])
    expect(descriptorFov(applied)).toBe(80)
  })

  // The rule `movesToCommand` holds for a drag: once a camera is animated, the switch stops
  // deciding — writing the descriptor would move the lens by whatever the key already adds.
  it('keeps keying a channel that already holds one, whatever the switch says', () => {
    const first = lensToCommand(lensed, [camera], 60, 0, true).apply(lensed)
    const second = lensToCommand(first, [camera], 80, 2 * SECOND, false).apply(first)

    expect(keysOf(second).map(key => key.value.x)).toEqual([10, 30])
    expect(descriptorFov(second)).toBe(50)
  })

  /**
   * The field shows what the channels PLAY, so what is written has to be picked by the same
   * filter. Keyed on a muted channel, the number typed would vanish the moment it was written.
   */
  it('writes the lens itself rather than keying a channel that is muted', () => {
    const keyed = lensToCommand(lensed, [camera], 60, 0, true).apply(lensed)
    const muted = updateAnimationTrack(keyed, 'lens', track => ({ ...track, muted: true }))
    const applied = lensToCommand(muted, [camera], 80, 0, true).apply(muted)

    expect(keysOf(applied).map(key => key.value.x)).toEqual([10])
    expect(descriptorFov(applied)).toBe(80)
  })

  // A locked channel goes on adding what it adds: writing the typed number into the descriptor
  // under it would leave the lens reading that number PLUS the channel's own share.
  it('writes under a locked channel what makes the lens read the number typed', () => {
    const keyed = lensToCommand(lensed, [camera], 70, 0, true).apply(lensed)
    const locked = updateAnimationTrack(keyed, 'lens', track => ({ ...track, locked: true }))
    const applied = lensToCommand(locked, [camera], 80, 0, true).apply(locked)

    expect(keysOf(applied).map(key => key.value.x)).toEqual([20])
    expect(descriptorFov(applied)).toBe(60)
    expect(60 + (fovAt(applied.animation, 'cam', 0) ?? 0)).toBe(80)
  })

  it('has the lens read between two keys, which is what a field of view animates for', () => {
    const first = lensToCommand(lensed, [camera], 50, 0, true).apply(lensed)
    const second = lensToCommand(first, [camera], 80, 2 * SECOND, true).apply(first)

    expect(50 + (fovAt(second.animation, 'cam', 1 * SECOND) ?? 0)).toBe(65)
  })
})

describe('the shots of a sequence', () => {
  const shot = cameraShot('s1', { start: 1 * SECOND, duration: 2 * SECOND })
  const other = cameraShot('s2', { cameraId: 'cam-b', start: 4 * SECOND })
  const start: SceneState = {
    ...EMPTY_SCENE,
    animation: { ...EMPTY_SCENE.animation, shots: [shot, other] },
  }

  // The shot joins the end of its camera's own run, so the line the user dragged keeps its rank.
  it('puts a camera on air, and takes it back off on undo', () => {
    const command = addCameraShot(cameraShot('s3'))
    const applied = command.apply(start)

    expect(applied.animation.shots.map(held => held.id)).toEqual(['s1', 's3', 's2'])
    expect(command.revert(applied)).toEqual(start)
  })

  // A shot laid down only to be hidden by what was already there reads as a button doing nothing.
  it('opens the stack with a camera the band did not show yet', () => {
    const applied = addCameraShot(cameraShot('s3', { cameraId: 'cam-c' })).apply(start)

    expect(applied.animation.shots.map(held => held.id)).toEqual(['s3', 's1', 's2'])
  })

  // Two shots of one layer starting together are settled by their order, so a shot restored at
  // the end would come back on top of what it was under.
  it('puts a removed shot back where it stood', () => {
    const command = removeCameraShot('s1')
    const applied = command.apply(start)

    expect(applied.animation.shots.map(held => held.id)).toEqual(['s2'])
    expect(command.revert(applied).animation.shots.map(held => held.id)).toEqual(['s1', 's2'])
  })

  it('moves and trims through one command, and reverts the whole shot', () => {
    const edit = editCameraShot('s1', { start: 5 * SECOND, duration: 1 * SECOND })
    const moved = edit.apply(start)

    expect(moved.animation.shots[0]).toMatchObject({ start: 5 * SECOND, duration: 1 * SECOND })
    expect(edit.revert(moved)).toEqual(start)
  })

  it('leaves the state alone when the shot named is gone', () => {
    expect(editCameraShot('nowhere', { start: 9 * SECOND }).apply(start)).toBe(start)
    expect(removeCameraShot('nowhere').apply(start)).toBe(start)
  })

  /**
   * The order of the lines is the montage's law, so dragging one is an edit of the document —
   * unlike the sheet's own arrangement, which no history holds.
   */
  it('writes the order it is given, and gives back the one that stood before', () => {
    const command = reorderCameraShots('cam-a', [other, shot])
    const applied = command.apply(start)

    expect(applied.animation.shots.map(held => held.id)).toEqual(['s2', 's1'])
    expect(command.revert(applied)).toEqual(start)
  })

  it('replays a whole drag rather than its last notch, once the steps have coalesced', () => {
    const third = cameraShot('s3', { cameraId: 'cam-c' })
    const from: SceneState = {
      ...start,
      animation: { ...start.animation, shots: [shot, other, third] },
    }

    const first = reorderCameraShots('cam-a', [other, shot, third])
    const last = reorderCameraShots('cam-a', [other, third, shot])

    // `coalesce` keeps the FIRST revert and the LAST apply, so the last apply has to describe the
    // drag from where it STARTED — a command holding a step would redo one notch of the two.
    first.apply(from)
    const replayed = last.apply(from)

    expect(replayed.animation.shots.map(held => held.id)).toEqual(['s2', 's3', 's1'])
    expect(first.revert(replayed)).toEqual(from)
  })

  /**
   * A rail drives nothing without a shot to run it, so asking for one asks for both — and the
   * button was unreachable until a shot had been posed from another panel, with nothing saying so.
   */
  it('opens a shot and lays its rail in one gesture, and takes back both', () => {
    const camera = cameraNodeFixture('cam-c')
    const fresh = cameraShot('s3', { cameraId: 'cam-c' })
    const command = railOnNewShot(camera, fresh)
    const applied = command.apply({ ...start, nodes: [camera] })

    const laid = applied.animation.shots.find(held => held.id === 's3')
    expect(applied.nodes.filter(node => node.type === 'path')).toHaveLength(1)
    expect(laid?.motion?.pathId).toBe(applied.nodes.find(node => node.type === 'path')?.id)

    expect(command.revert(applied)).toEqual({ ...start, nodes: [camera] })
  })

  // Where the camera stands, so the rail starts under it rather than at the world's origin.
  it('lays the rail on the camera it belongs to', () => {
    const camera = {
      ...cameraNodeFixture('cam-c'),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 3, y: 1, z: -2 } },
    }
    const applied = railOnNewShot(camera, cameraShot('s3', { cameraId: 'cam-c' })).apply({
      ...start,
      nodes: [camera],
    })

    expect(applied.nodes.find(node => node.type === 'path')?.transform.position).toEqual({
      x: 3,
      y: 1,
      z: -2,
    })
  })
})
