import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE, SCENE_SUBJECT_ID } from '@shared/domain/animation'
import { DEFAULT_CAMERA, DEFAULT_WORLD } from '@shared/domain/scene'
import { EMPTY_STACK, postEffect, type PostStack } from '@shared/domain/postProcessing'
import { stackFromPreset } from '@shared/domain/postPresets'
import type { Command } from '../core/history'
import {
  addPostEffect,
  applyPostStack,
  duplicatePostEffect,
  keyPostParam,
  movePostEffect,
  postChannelOf,
  postStackOf,
  removePostEffectWholly,
  reorderPostEffects,
  resetPostEffect,
  SCENE_POST,
  setCameraPostMode,
  setPostEffectEnabled,
  setPostEnabled,
  setPostParam,
  unkeyPostParam,
  type PostTargetRef,
} from './postCommands'
import type { SceneNode, SceneState } from './sceneState'

let minted = 0
const mintId = (): string => `made-${(minted += 1)}`

const CAMERA: SceneNode = {
  id: 'cam',
  parentId: null,
  name: 'Camera 01',
  visible: true,
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  },
  castShadow: false,
  receiveShadow: false,
  type: 'camera',
  camera: DEFAULT_CAMERA,
}

const sceneWith = (post: PostStack, nodes: readonly SceneNode[] = []): SceneState => ({
  nodes,
  selectedIds: [],
  world: { ...DEFAULT_WORLD, post },
  animation: EMPTY_TIMELINE,
})

const bloom = (id = 'a'): PostStack => ({
  enabled: true,
  effects: [postEffect(id, 'bloom')],
})

/** Applied then reverted — what ⌘Z has to give back, on every command of the family. */
const roundTrip = (state: SceneState, command: Command<SceneState>): SceneState =>
  command.revert(command.apply(state))

const CAMERA_TARGET: PostTargetRef = { kind: 'camera', nodeId: 'cam' }

describe('editing a composition', () => {
  it('adds an effect on the defaults of its own kind', () => {
    const after = addPostEffect(SCENE_POST, 'vignette', 'v').apply(sceneWith(EMPTY_STACK))

    expect(after.world.post.effects).toEqual([
      { id: 'v', effect: 'vignette', enabled: true, params: { offset: 1, darkness: 1 } },
    ])
  })

  it('holds a parameter to the spec of the effect it belongs to', () => {
    const after = setPostParam(SCENE_POST, 'a', 'strength', 99).apply(sceneWith(bloom()))

    expect(after.world.post.effects[0]?.params.strength).toBe(4)
  })

  it('leaves an effect alone when the parameter is not one of its own', () => {
    const held = sceneWith(bloom())
    const after = setPostParam(SCENE_POST, 'a', 'darkness', 2).apply(held)

    expect(after.world.post.effects[0]?.params).toEqual(held.world.post.effects[0]?.params)
  })

  it('switches one effect off without losing what it holds', () => {
    const moved = setPostParam(SCENE_POST, 'a', 'strength', 2).apply(sceneWith(bloom()))
    const after = setPostEffectEnabled(SCENE_POST, 'a', false).apply(moved)

    expect(after.world.post.effects[0]?.enabled).toBe(false)
    expect(after.world.post.effects[0]?.params.strength).toBe(2)
  })

  it('switches the whole composition off, which is the Before/After', () => {
    const after = setPostEnabled(SCENE_POST, false).apply(sceneWith(bloom()))

    expect(after.world.post.enabled).toBe(false)
    expect(after.world.post.effects).toHaveLength(1)
  })

  it('reorders by the ids it is given', () => {
    const two: PostStack = {
      enabled: true,
      effects: [postEffect('a', 'bloom'), postEffect('b', 'vignette')],
    }
    const after = reorderPostEffects(SCENE_POST, ['b', 'a']).apply(sceneWith(two))

    expect(after.world.post.effects.map(one => one.id)).toEqual(['b', 'a'])
  })

  /** An order is a GESTURE, computed against what was on screen — it must not delete anything. */
  it('keeps an effect the order forgot rather than dropping it', () => {
    const two: PostStack = {
      enabled: true,
      effects: [postEffect('a', 'bloom'), postEffect('b', 'vignette')],
    }
    const after = reorderPostEffects(SCENE_POST, ['b']).apply(sceneWith(two))

    expect(after.world.post.effects.map(one => one.id)).toEqual(['b', 'a'])
  })

  it('moves one effect by places', () => {
    const two: PostStack = {
      enabled: true,
      effects: [postEffect('a', 'bloom'), postEffect('b', 'vignette')],
    }
    const after = movePostEffect(SCENE_POST, 'a', 1).apply(sceneWith(two))

    expect(after.world.post.effects.map(one => one.id)).toEqual(['b', 'a'])
  })

  it('copies an effect right after the one it copies', () => {
    const after = duplicatePostEffect(SCENE_POST, 'a', 'copy').apply(sceneWith(bloom()))

    expect(after.world.post.effects.map(one => one.id)).toEqual(['a', 'copy'])
  })

  it('refuses to copy an effect a second instance of means nothing', () => {
    const held = sceneWith({ enabled: true, effects: [postEffect('s', 'smaa')] })
    const after = duplicatePostEffect(SCENE_POST, 's', 'copy').apply(held)

    expect(after.world.post.effects).toHaveLength(1)
  })

  it('puts one effect back on its own defaults', () => {
    const moved = setPostParam(SCENE_POST, 'a', 'strength', 2).apply(sceneWith(bloom()))
    const after = resetPostEffect(SCENE_POST, 'a').apply(moved)

    expect(after.world.post.effects[0]?.params.strength).toBe(0.6)
  })

  /** Applying a look while the comparison is off must not turn it back on under one's hand. */
  it('keeps the composition switch when a preset is applied', () => {
    const off = setPostEnabled(SCENE_POST, false).apply(sceneWith(bloom()))
    const after = applyPostStack(SCENE_POST, stackFromPreset('cinematic', mintId)).apply(off)

    expect(after.world.post.enabled).toBe(false)
    expect(after.world.post.effects.length).toBeGreaterThan(1)
  })
})

describe('what undo gives back', () => {
  const held = sceneWith(bloom(), [CAMERA])

  it.each([
    ['add', addPostEffect(SCENE_POST, 'vignette', 'v')],
    ['remove one parameter', setPostParam(SCENE_POST, 'a', 'strength', 3)],
    ['reorder', reorderPostEffects(SCENE_POST, ['a'])],
    ['switch off', setPostEnabled(SCENE_POST, false)],
    ['apply a preset', applyPostStack(SCENE_POST, stackFromPreset('horror', mintId))],
  ])('puts the composition back after %s', (_what, command) => {
    expect(roundTrip(held, command).world.post).toEqual(held.world.post)
  })

  it('puts a camera back after its mode changed', () => {
    const command = setCameraPostMode(held, 'cam', 'override', mintId)

    expect(roundTrip(held, command).nodes).toEqual(held.nodes)
  })
})

describe('what a camera does about the composition', () => {
  const held = sceneWith(bloom(), [CAMERA])

  it('owns nothing while it inherits — which is what sends a hand to the scene', () => {
    expect(postStackOf(held, CAMERA_TARGET)).toBeNull()
  })

  /** One starts from the picture in front of them, not from an empty stack. */
  it('seeds an override with what the camera was already filming, under fresh ids', () => {
    const after = setCameraPostMode(held, 'cam', 'override', mintId).apply(held)
    const own = postStackOf(after, CAMERA_TARGET)

    expect(own?.effects.map(one => one.effect)).toEqual(['bloom'])
    expect(own?.effects[0]?.id).not.toBe('a')
  })

  it('writes an edit onto the camera once it overrides, leaving the scene alone', () => {
    const overriding = setCameraPostMode(held, 'cam', 'override', mintId).apply(held)
    const effectId = postStackOf(overriding, CAMERA_TARGET)?.effects[0]?.id ?? ''
    const after = setPostParam(CAMERA_TARGET, effectId, 'strength', 2).apply(overriding)

    expect(postStackOf(after, CAMERA_TARGET)?.effects[0]?.params.strength).toBe(2)
    expect(after.world.post.effects[0]?.params.strength).toBe(0.6)
  })

  /** Absent already means `inherit`: written out, a file would grow for nothing. */
  it('drops the field entirely when it goes back to inheriting', () => {
    const overriding = setCameraPostMode(held, 'cam', 'override', mintId).apply(held)
    const back = setCameraPostMode(overriding, 'cam', 'inherit', mintId).apply(overriding)
    const camera = back.nodes[0]

    expect(camera?.type === 'camera' && 'post' in camera.camera).toBe(false)
  })

  it('refuses a mode the camera already stands in', () => {
    expect(setCameraPostMode(held, 'cam', 'inherit', mintId).refuses?.(held)).toBe(true)
  })
})

describe('keying a composition parameter', () => {
  const held = sceneWith(bloom())

  it('opens a channel and writes the DELTA from what the document holds', () => {
    const command = keyPostParam(
      held,
      SCENE_POST,
      'a',
      'strength',
      0,
      1.6,
      'Bloom · Strength',
      mintId,
    )
    const after = command?.apply(held)
    const channel = after && postChannelOf(after, SCENE_POST, 'a', 'strength')

    expect(channel?.target.nodeId).toBe(SCENE_SUBJECT_ID)
    expect(channel?.keys[0]?.value.x).toBeCloseTo(1, 5)
  })

  it('writes into the channel already open rather than a second one', () => {
    const first = keyPostParam(held, SCENE_POST, 'a', 'strength', 0, 1.6, 'x', mintId)?.apply(held)
    const both =
      first && keyPostParam(first, SCENE_POST, 'a', 'strength', 100, 2, 'x', mintId)?.apply(first)

    expect(both?.animation.tracks).toHaveLength(1)
    expect(both?.animation.tracks[0]?.keys).toHaveLength(2)
  })

  it('refuses a parameter its own spec calls still', () => {
    const grain = sceneWith({ enabled: true, effects: [postEffect('g', 'filmGrain')] })

    expect(keyPostParam(grain, SCENE_POST, 'g', 'animated', 0, 1, 'x', mintId)).toBeNull()
  })

  it('takes a key back off the channel it stands on', () => {
    const keyed = keyPostParam(held, SCENE_POST, 'a', 'strength', 0, 1.6, 'x', mintId)?.apply(held)
    const after = keyed && unkeyPostParam(keyed, SCENE_POST, 'a', 'strength', 0)?.apply(keyed)

    expect(after?.animation.tracks[0]?.keys).toEqual([])
  })

  /**
   * A stack left with rows on the band driving an instance nobody can reach is worse than either
   * half of the problem — and a ⌘Z bringing the effect back finds its animation with it.
   */
  it('takes the channels of an effect away with the effect', () => {
    const keyed = keyPostParam(held, SCENE_POST, 'a', 'strength', 0, 1.6, 'x', mintId)?.apply(held)
    const command = keyed && removePostEffectWholly(keyed, SCENE_POST, 'a')
    const after = keyed && command?.apply(keyed)

    expect(after?.world.post.effects).toEqual([])
    expect(after?.animation.tracks).toEqual([])
    expect(keyed && command && roundTrip(keyed, command)).toEqual(keyed)
  })
})
