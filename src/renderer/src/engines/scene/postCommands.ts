/**
 * Every edit a composition can take, as commands — so ⌘Z gives back an effect, an order, a
 * parameter or a preset without a line of undo written for any of them.
 *
 * They all come down to reading one stack, changing it, and writing it back. Which stack that is
 * — the scene's, or a camera's own — is the caller's, and it is the only thing that varies.
 */
import {
  defaultParamsOf,
  postEffect,
  POST_EFFECTS,
  boundParam,
  EMPTY_STACK,
  type CameraPost,
  type CameraPostMode,
  type PostEffect,
  type PostEffectId,
  type PostParamValue,
  type PostStack,
} from '@shared/domain/postProcessing'
import { drivesPost, SCENE_SUBJECT_ID, type AnimationTrack } from '@shared/domain/animation'
import { movedWithin } from '@shared/domain/order'
import type { CameraDescriptor } from '@shared/domain/scene'
import type { Us } from '@shared/domain/time'
import {
  addAnimationTrack,
  removeAnimationKey,
  removeAnimationTrack,
  setAnimationKey,
} from './animationCommands'
import { multi } from './commands'
import type { Command } from '../core/history'
import { newId } from '@/helpers/ids'
import type { SceneNode, SceneState } from './sceneState'

/** Whose composition is being edited. A camera only owns one while it is overriding. */
export type PostTargetRef = { kind: 'scene' } | { kind: 'camera'; nodeId: string }

export const SCENE_POST: PostTargetRef = Object.freeze({ kind: 'scene' })

/**
 * The stack a target owns, or `null` when it owns none — a camera inheriting or disabled.
 *
 * `null` is not an error: it is what tells the panel to edit the SCENE instead, which is what
 * « Inherit » means when a hand reaches for a slider.
 */
export function postStackOf(state: SceneState, target: PostTargetRef): PostStack | null {
  if (target.kind === 'scene') return state.world.post

  const node = state.nodes.find(candidate => candidate.id === target.nodeId)
  if (node?.type !== 'camera') return null
  return node.camera.post?.mode === 'override' ? node.camera.post.stack : null
}

/** Spelled out rather than inferred: `as const` is refused, and a widened `mode` breaks the union. */
const overriding = (stack: PostStack): CameraPost => ({ mode: 'override', stack })

function writeStack(state: SceneState, target: PostTargetRef, stack: PostStack): SceneState {
  if (target.kind === 'scene') return { ...state, world: { ...state.world, post: stack } }

  return {
    ...state,
    nodes: state.nodes.map(node =>
      node.id === target.nodeId && node.type === 'camera'
        ? { ...node, camera: { ...node.camera, post: overriding(stack) } }
        : node,
    ),
  }
}

/**
 * One edit of one stack.
 *
 * The `id` is the caller's and it is not decoration: the history may coalesce two consecutive
 * commands on it, so a slider drag has to be named after the very parameter it moves — named
 * after the target alone, adding an effect would merge with the drag that followed it.
 */
function editStack(
  target: PostTargetRef,
  id: string,
  change: (stack: PostStack) => PostStack,
): Command<SceneState> {
  let previous: PostStack | null = null

  return {
    id,
    refuses: state => postStackOf(state, target) === null,
    apply: state => {
      const held = postStackOf(state, target)
      if (!held) return state
      previous = held
      return writeStack(state, target, change(held))
    },
    revert: state => (previous ? writeStack(state, target, previous) : state),
  }
}

const handleOf = (target: PostTargetRef): string =>
  target.kind === 'scene' ? 'scene' : target.nodeId

export function addPostEffect(
  target: PostTargetRef,
  effect: PostEffectId,
  id = newId(),
): Command<SceneState> {
  return editStack(target, `post:add:${handleOf(target)}`, stack => ({
    ...stack,
    effects: [...stack.effects, postEffect(id, effect)],
  }))
}

export function removePostEffect(target: PostTargetRef, effectId: string): Command<SceneState> {
  return editStack(target, `post:remove:${handleOf(target)}:${effectId}`, stack => ({
    ...stack,
    effects: stack.effects.filter(one => one.id !== effectId),
  }))
}

/**
 * A copy of one effect, right after the one it copies — refused where a second instance would
 * mean nothing, an anti-aliaser or an occlusion pass being the same twice over.
 */
export function duplicatePostEffect(
  target: PostTargetRef,
  effectId: string,
  id = newId(),
): Command<SceneState> {
  return editStack(target, `post:duplicate:${handleOf(target)}:${effectId}`, stack => {
    const at = stack.effects.findIndex(one => one.id === effectId)
    const held = stack.effects[at]
    if (!held || !POST_EFFECTS[held.effect].duplicable) return stack

    const effects = [...stack.effects]
    effects.splice(at + 1, 0, { ...held, id })
    return { ...stack, effects }
  })
}

/** Moved by places within its own list — `by` is negative to move earlier in the chain. */
export function movePostEffect(
  target: PostTargetRef,
  effectId: string,
  by: number,
): Command<SceneState> {
  return editStack(target, `post:move:${handleOf(target)}:${effectId}`, stack => {
    const order = movedWithin(
      stack.effects.map(one => one.id),
      effectId,
      by,
    )
    return { ...stack, effects: inOrder(stack.effects, order) }
  })
}

/** The whole list, reordered by a drag. The ids the caller names, in the order it names them. */
export function reorderPostEffects(
  target: PostTargetRef,
  order: readonly string[],
): Command<SceneState> {
  return editStack(target, `post:reorder:${handleOf(target)}`, stack => ({
    ...stack,
    effects: inOrder(stack.effects, order),
  }))
}

function inOrder(effects: readonly PostEffect[], order: readonly string[]): PostEffect[] {
  const byId = new Map(effects.map(one => [one.id, one]))
  const moved = order.flatMap(id => {
    const found = byId.get(id)
    if (found) byId.delete(id)
    return found ? [found] : []
  })
  // Anything the order forgot keeps its place at the end rather than vanishing: an order is a
  // gesture, and a gesture computed against a stale list must not delete an effect.
  return [...moved, ...byId.values()]
}

export function setPostEffectEnabled(
  target: PostTargetRef,
  effectId: string,
  enabled: boolean,
): Command<SceneState> {
  return editStack(target, `post:enabled:${handleOf(target)}:${effectId}`, stack => ({
    ...stack,
    effects: stack.effects.map(one => (one.id === effectId ? { ...one, enabled } : one)),
  }))
}

/** The composition's own switch — Before/After, and an edit ⌘Z takes back. */
export function setPostEnabled(target: PostTargetRef, enabled: boolean): Command<SceneState> {
  return editStack(target, `post:switch:${handleOf(target)}`, stack => ({ ...stack, enabled }))
}

/**
 * One parameter. The value is held to the spec of the effect it belongs to, so a command is never
 * the way a number nobody could have typed gets into a document.
 */
export function setPostParam(
  target: PostTargetRef,
  effectId: string,
  param: string,
  value: PostParamValue,
): Command<SceneState> {
  return editStack(target, `post:param:${handleOf(target)}:${effectId}:${param}`, stack => ({
    ...stack,
    effects: stack.effects.map(one => {
      const spec = one.id === effectId ? POST_EFFECTS[one.effect].params[param] : undefined
      return spec ? { ...one, params: { ...one.params, [param]: boundParam(spec, value) } } : one
    }),
  }))
}

/** One effect back to what a fresh one of its kind holds. */
export function resetPostEffect(target: PostTargetRef, effectId: string): Command<SceneState> {
  return editStack(target, `post:reset:${handleOf(target)}:${effectId}`, stack => ({
    ...stack,
    effects: stack.effects.map(one =>
      one.id === effectId ? { ...one, params: defaultParamsOf(one.effect) } : one,
    ),
  }))
}

/** A whole composition put in place of the one there — what applying a preset comes down to. */
export function applyPostStack(target: PostTargetRef, stack: PostStack): Command<SceneState> {
  return editStack(target, `post:stack:${handleOf(target)}`, held => ({
    ...stack,
    // The switch is the person's, not the preset's: applying a look while the comparison is off
    // must not turn it back on under their hand.
    enabled: held.enabled,
  }))
}

/**
 * What a camera does about the scene's composition.
 *
 * Going to `override` SEEDS the camera with what it was already filming through, under fresh
 * instance ids — one starts from the picture in front of them, not from an empty stack, and the
 * ids are new so a channel keyed on the scene does not silently drive a camera's copy.
 */
export function setCameraPostMode(
  state: SceneState,
  nodeId: string,
  mode: CameraPostMode,
  mintId: () => string = newId,
): Command<SceneState> {
  const node = state.nodes.find(candidate => candidate.id === nodeId)
  const held = node?.type === 'camera' ? node.camera.post : undefined
  const seed: PostStack =
    held?.mode === 'override' ? held.stack : copiedStack(state.world.post, mintId)

  let previous: SceneNode | null = null

  return {
    id: `post:mode:${nodeId}`,
    refuses: candidate => {
      const found = candidate.nodes.find(one => one.id === nodeId)
      return found?.type !== 'camera' || (found.camera.post?.mode ?? 'inherit') === mode
    },
    apply: candidate => writeMode(candidate, nodeId, mode, seed, taken => (previous = taken)),
    revert: candidate => {
      const taken = previous
      if (!taken) return candidate
      return { ...candidate, nodes: candidate.nodes.map(one => (one.id === nodeId ? taken : one)) }
    },
  }
}

function writeMode(
  state: SceneState,
  nodeId: string,
  mode: CameraPostMode,
  seed: PostStack,
  remember: (node: SceneNode) => void,
): SceneState {
  return {
    ...state,
    nodes: state.nodes.map(node => {
      if (node.id !== nodeId || node.type !== 'camera') return node
      remember(node)

      if (mode === 'inherit') {
        // The field is DROPPED rather than written as `inherit`: absent already means it, and a
        // file that spells it out is a file that grew for nothing.
        return { ...node, camera: withoutPost(node.camera) }
      }
      return {
        ...node,
        camera: {
          ...node.camera,
          post: mode === 'disabled' ? DISABLED_POST : overriding(seed),
        },
      }
    }),
  }
}

const DISABLED_POST: CameraPost = Object.freeze({ mode: 'disabled' })

/**
 * The lens without its composition. `inherit` is what an ABSENT field already means, so it is
 * dropped rather than written out — a file that spells it is a file that grew for nothing.
 */
function withoutPost(camera: CameraDescriptor): CameraDescriptor {
  const lens = { ...camera }
  delete lens.post
  return lens
}

/** The same composition under fresh instance ids — see `setCameraPostMode`. */
export function copiedStack(stack: PostStack, mintId: () => string = newId): PostStack {
  return {
    ...(stack.effects.length === 0 ? EMPTY_STACK : stack),
    effects: stack.effects.map(one => ({ ...one, id: mintId() })),
  }
}

/**
 * Which subject of the band a target is keyed under.
 *
 * A camera is a node and answers to its own id; the scene's own composition answers to the
 * reserved one, which no node can hold — see `SCENE_SUBJECT_ID`.
 */
export function postSubjectOf(target: PostTargetRef): string {
  return target.kind === 'scene' ? SCENE_SUBJECT_ID : target.nodeId
}

/** The channel driving one parameter of one effect, if a hand has opened it. */
export function postChannelOf(
  state: SceneState,
  target: PostTargetRef,
  effectId: string,
  param: string,
): AnimationTrack | undefined {
  const subject = postSubjectOf(target)
  return state.animation.tracks.find(
    track =>
      track.target.nodeId === subject &&
      drivesPost(track.target) &&
      track.target.post.effectId === effectId &&
      track.target.post.param === param,
  )
}

/**
 * A key on one composition parameter, for the ABSOLUTE value the panel shows.
 *
 * The channel is opened where none exists yet, and the DELTA is worked out here — a key holds
 * what a channel adds to what the document stores, exactly as a lens key does. `null` where
 * there is nothing to key: no stack, no such effect, or a parameter its own spec calls still.
 */
export function keyPostParam(
  state: SceneState,
  target: PostTargetRef,
  effectId: string,
  param: string,
  time: Us,
  value: number,
  name: string,
  mintId: () => string = newId,
): Command<SceneState> | null {
  const stack = postStackOf(state, target)
  const effect = stack?.effects.find(one => one.id === effectId)
  const spec = effect ? POST_EFFECTS[effect.effect].params[param] : undefined
  const base = effect?.params[param]
  if (!spec?.animatable || typeof base !== 'number') return null

  const delta = { x: value - base, y: 0, z: 0 }
  const held = postChannelOf(state, target, effectId, param)
  if (held) return setAnimationKey(held.id, time, delta)

  const trackId = mintId()
  return multi(`post:key:${effectId}:${param}`, [
    addAnimationTrack(
      { nodeId: postSubjectOf(target), property: 'post', post: { effectId, param } },
      name,
      trackId,
    ),
    setAnimationKey(trackId, time, delta),
  ])
}

/** Takes the key back off a composition channel at that instant. */
export function unkeyPostParam(
  state: SceneState,
  target: PostTargetRef,
  effectId: string,
  param: string,
  time: Us,
): Command<SceneState> | null {
  const held = postChannelOf(state, target, effectId, param)
  return held ? removeAnimationKey(held.id, time) : null
}

/**
 * Every channel an effect carries goes when the effect does.
 *
 * Without it a stack would leave rows on the band driving an instance nobody can reach — and a
 * ⌘Z bringing the effect back would find its animation gone, which is worse than either.
 */
export function removePostEffectWholly(
  state: SceneState,
  target: PostTargetRef,
  effectId: string,
): Command<SceneState> {
  const subject = postSubjectOf(target)
  const doomed = state.animation.tracks.filter(
    track =>
      track.target.nodeId === subject &&
      drivesPost(track.target) &&
      track.target.post.effectId === effectId,
  )

  return multi(`post:remove:${handleOf(target)}:${effectId}`, [
    ...doomed.map(track => removeAnimationTrack(track.id)),
    removePostEffect(target, effectId),
  ])
}
