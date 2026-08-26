import {
  boundParam,
  CAMERA_POST_MODES,
  isPostEffectId,
  planStack,
  POST_EFFECTS,
  type PostStack,
} from '@shared/domain/postProcessing'
import { isPostPresetId, stackFromPreset } from '@shared/domain/postPresets'
import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { Command } from '@/engines/core/history'
import {
  addPostEffect,
  applyPostStack,
  movePostEffect,
  postStackOf,
  removePostEffectWholly,
  setCameraPostMode,
  setPostEffectEnabled,
  setPostEnabled,
  setPostParam,
  type PostTargetRef,
} from '@/engines/scene/postCommands'
import type { SceneState } from '@/engines/scene/sceneState'
import { newId } from '@/helpers/ids'
import { useScenes } from '@/stores/scenes'
import type { ActionHandlers } from './actionHandler'
import { maybeBoolOf, numberOf, oneOf, textOf } from './actionInputs'
import { nodeAimed } from './nodeAimed'
import { mounted } from './sceneHandlers'

/**
 * The composition, driven by value. Nothing here knows what a bloom is: both the effect and the
 * parameter are checked against `POST_EFFECTS`, so a call naming a knob that does not exist is
 * refused rather than writing a field nothing reads.
 */

/**
 * Absent means the SCENE's — what a first call means. A camera that does not OWN a stack answers
 * the scene's target rather than refusing: asking a camera in `inherit` to change a bloom is
 * asking the scene to.
 */
function targetOf(input: Record<string, unknown>, state: SceneState): PostTargetRef | null {
  const named = textOf(input, 'cameraId')
  if (named === null) return { kind: 'scene' }

  // By id OR by name, like every other node-facing action of the registry — a client that can
  // say « Camera 01 » everywhere else must not have to find an id here.
  const node = nodeAimed(state, named)
  if (node?.type !== 'camera') return null
  return node.camera.post?.mode === 'override'
    ? { kind: 'camera', nodeId: node.id }
    : { kind: 'scene' }
}

/** One edit of the composition a call names, run on the scene in front. */
function editPost(
  input: Record<string, unknown>,
  build: (target: PostTargetRef, stack: PostStack, state: SceneState) => Command<SceneState> | null,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const target = targetOf(input, open.state)
  if (!target) return refused('notFound', 'no camera of that id in the scene in front')

  const stack = postStackOf(open.state, target)
  if (!stack) return refused('notFound')

  const command = build(target, stack, open.state)
  if (!command) return refused('badInput')

  useScenes.getState().runCommand(open.documentId, command)
  return { ok: true }
}

/** The instance a call names, checked against the stack it claims to be in. */
function effectIn(stack: PostStack, input: Record<string, unknown>): string | null {
  const effectId = textOf(input, 'effectId') ?? ''
  return stack.effects.some(one => one.id === effectId) ? effectId : null
}

export const POST_HANDLERS: ActionHandlers = {
  /** The ids of the instances, what each one is, and which of them the plan actually runs. */
  'post.state': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const target = targetOf(input, open.state)
    if (!target) return refused('notFound')

    // `targetOf` only answers a camera that OWNS a stack, so this is never `null` here — it is
    // the scene's otherwise, which is what the camera would be filming through anyway.
    const stack = postStackOf(open.state, target) ?? open.state.world.post
    const skipped = new Set(planStack(stack).skipped.map(one => one.id))

    return {
      ok: true,
      data: {
        owner: target.kind,
        enabled: stack.enabled,
        effects: stack.effects.map(one => ({
          id: one.id,
          effect: one.effect,
          enabled: one.enabled,
          skipped: skipped.has(one.id),
          params: one.params,
        })),
      },
    }
  },

  'post.add': input => {
    const effect = textOf(input, 'effect') ?? ''
    if (!isPostEffectId(effect)) return refused('badInput')
    return editPost(input, target => addPostEffect(target, effect, newId()))
  },

  'post.remove': input =>
    editPost(input, (target, stack, state) => {
      const effectId = effectIn(stack, input)
      return effectId ? removePostEffectWholly(state, target, effectId) : null
    }),

  'post.move': input =>
    editPost(input, (target, stack) => {
      const effectId = effectIn(stack, input)
      const by = numberOf(input, 'by')
      return effectId && by !== null ? movePostEffect(target, effectId, by) : null
    }),

  /** Which of the three value fields a call may use is the SPEC's to say, never a coercion. */
  'post.set': input =>
    editPost(input, (target, stack) => {
      const effectId = effectIn(stack, input)
      const effect = stack.effects.find(one => one.id === effectId)
      const param = textOf(input, 'param') ?? ''
      const spec = effect ? POST_EFFECTS[effect.effect].params[param] : undefined
      if (!effectId || !spec) return null

      const given =
        spec.control === 'toggle'
          ? maybeBoolOf(input, 'on')
          : spec.control === 'number' || spec.control === 'slider'
            ? numberOf(input, 'value')
            : textOf(input, 'text')
      if (given === null) return null

      return setPostParam(target, effectId, param, boundParam(spec, given))
    }),

  'post.enable': input =>
    editPost(input, (target, stack) => {
      const effectId = effectIn(stack, input)
      const enabled = maybeBoolOf(input, 'enabled')
      return effectId && enabled !== null ? setPostEffectEnabled(target, effectId, enabled) : null
    }),

  'post.switch': input =>
    editPost(input, target => {
      const enabled = maybeBoolOf(input, 'enabled')
      return enabled === null ? null : setPostEnabled(target, enabled)
    }),

  'post.preset': input =>
    editPost(input, target => {
      const preset = textOf(input, 'preset') ?? ''
      return isPostPresetId(preset) ? applyPostStack(target, stackFromPreset(preset, newId)) : null
    }),

  'post.camera': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const node = nodeAimed(open.state, textOf(input, 'nodeId') ?? '')
    if (node?.type !== 'camera') return refused('notFound')

    const mode = oneOf(input, 'mode', CAMERA_POST_MODES)
    if (mode === null) return refused('badInput')

    useScenes.getState().runCommand(open.documentId, setCameraPostMode(open.state, node.id, mode))
    return { ok: true }
  },
}
