import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { HUMANOID_ROLES, type HumanoidRole } from '@shared/domain/humanoid'
import { childBone } from '@shared/domain/rig'
import { assetClip } from '@shared/domain/scene'
import { secondsToUs } from '@shared/domain/time'
import { setTimelineSettings } from '@/engines/scene/animationCommands'
import {
  addIkChain,
  addModelClip,
  addRigBone,
  addRigHands,
  removeIkChain,
  removeModelClip,
  removeRigBone,
  renameRigBone,
  setModelRig,
  setRigBoneRole,
} from '@/engines/scene/commands'
import type { Command } from '@/engines/core/history'
import { rigFit, rigFitFaultOf } from '@/engines/scene/rigFit'
import { nodeById, type ModelNode, type SceneState } from '@/engines/scene/sceneState'
import { newId } from '@/helpers/ids'
import { assetsById, useAssets } from '@/stores/assets'
import { useAnimationViews } from '@/stores/animationView'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { rigOfNode, useModelClips } from '@/stores/modelClips'
import { sceneOf, useScenes } from '@/stores/scenes'
import { type ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, textOf } from './actionInputs'

/**
 * The skeleton of a character, the handles its joints reach for, and the blocks laid on its band.
 *
 * Every edit goes through the command the inspector and the band already run, so it lands in the
 * scene's own history and ⌘Z takes it back. Nothing is rebuilt here.
 */

/** The 3D tab in front and the model named in it, or the reason there is none. */
function model(
  input: Record<string, unknown>,
): { documentId: string; state: SceneState; node: ModelNode } | null {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return null

  const state = sceneOf(useScenes.getState(), documentId)
  const node = nodeById(state, textOf(input, 'nodeId') ?? '')
  return node?.type === 'model' ? { documentId, state, node } : null
}

/** Runs one command on the model named, refusing before it rather than writing nothing. */
function editModelOf(
  input: Record<string, unknown>,
  build: (node: ModelNode) => Command<SceneState> | null,
): ActionOutcome {
  const open = model(input)
  if (!open) return refused('wrongSurface')

  const command = build(open.node)
  if (!command) return refused('notFound')

  useScenes.getState().runCommand(open.documentId, command)
  return { ok: true }
}

/** The bone named on that model, so a name nobody answers to is a refusal rather than a no-op. */
function boneOf(node: ModelNode, name: string | null): string | null {
  return name !== null && node.model.rig?.bones.some(bone => bone.name === name) ? name : null
}

/**
 * The skeleton the studio fits to the mesh it has measured.
 *
 * `null` bounds mean the engine has not read the model yet, which is a wait rather than a fault —
 * and a fit refused by `rigFitFaultOf` is a mesh the studio cannot rig at all.
 */
function fitRig(input: Record<string, unknown>): ActionOutcome {
  const open = model(input)
  if (!open) return refused('wrongSurface')

  const bounds = rigOfNode(useModelClips.getState(), open.documentId, open.node.id)?.bounds
  if (!bounds) return refused('notFound')
  if (rigFitFaultOf(bounds)) return refused('failed')

  useScenes.getState().runCommand(open.documentId, setModelRig(open.node.id, rigFit(bounds)))
  return { ok: true }
}

/** What the panels read off a character: its bones, their roles, its handles and its blocks. */
function rigState(input: Record<string, unknown>): ActionOutcome {
  const open = model(input)
  if (!open) return refused('wrongSurface')

  const rig = open.node.model.rig
  return {
    ok: true,
    data: {
      rigged: rig !== undefined,
      bones: rig?.bones ?? [],
      ik: rig?.ik ?? [],
      lanes: open.node.model.lanes ?? [],
      // What the engine measured, which is what decides whether a bare mesh can be rigged at all.
      status: rigOfNode(useModelClips.getState(), open.documentId, open.node.id)?.status ?? null,
    },
  }
}

/** A block on the band, from an asset of the library — the gesture the animations panel makes. */
function addAnimation(input: Record<string, unknown>): ActionOutcome {
  const assetId = textOf(input, 'assetId') ?? ''
  const asset = assetsById(useAssets.getState()).get(assetId)
  if (!asset) return refused('notFound')

  return editModelOf(input, node => addModelClip(node.id, assetClip(newId(), asset.id, asset.name)))
}

function timelineSettings(input: Record<string, unknown>): ActionOutcome {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return refused('wrongSurface')

  const seconds = numberOf(input, 'durationSeconds')
  const fps = numberOf(input, 'fps')
  if (seconds === null && fps === null) return refused('badInput')

  useScenes.getState().runCommand(
    documentId,
    setTimelineSettings({
      ...(seconds === null ? {} : { duration: secondsToUs(seconds) }),
      ...(fps === null ? {} : { fps }),
    }),
  )
  return { ok: true }
}

export const RIG_HANDLERS: ActionHandlers = {
  'rig.state': input => Promise.resolve(rigState(input)),
  'rig.fit': input => Promise.resolve(fitRig(input)),
  'rig.clear': input => Promise.resolve(editModelOf(input, node => setModelRig(node.id, null))),
  'rig.hands': input => Promise.resolve(editModelOf(input, node => addRigHands(node.id))),

  'bone.add': input =>
    Promise.resolve(
      editModelOf(input, node => {
        const parent = boneOf(node, textOf(input, 'parent'))
        return parent === null
          ? null
          : addRigBone(node.id, childBone(node.model.rig?.bones ?? [], parent))
      }),
    ),

  'bone.remove': input =>
    Promise.resolve(
      editModelOf(input, node => {
        const bone = boneOf(node, textOf(input, 'bone'))
        return bone === null ? null : removeRigBone(node.id, bone)
      }),
    ),

  'bone.rename': input =>
    Promise.resolve(
      editModelOf(input, node => {
        const bone = boneOf(node, textOf(input, 'bone'))
        const name = textOf(input, 'name') ?? ''
        // A name already taken is refused here rather than by the command, which writes nothing
        // for a duplicate — and a client told `ok` would believe the rename took.
        return bone === null || node.model.rig?.bones.some(one => one.name === name)
          ? null
          : renameRigBone(node.id, bone, name)
      }),
    ),

  'bone.role': input =>
    Promise.resolve(
      editModelOf(input, node => {
        const bone = boneOf(node, textOf(input, 'bone'))
        const role: HumanoidRole | null = oneOf(input, 'role', HUMANOID_ROLES)
        return bone === null ? null : setRigBoneRole(node.id, bone, role)
      }),
    ),

  'ik.add': input =>
    Promise.resolve(
      editModelOf(input, node => {
        const bone = boneOf(node, textOf(input, 'bone'))
        return bone === null ? null : addIkChain(node.id, bone)
      }),
    ),

  'ik.remove': input =>
    Promise.resolve(
      editModelOf(input, node => {
        const chainId = textOf(input, 'chainId') ?? ''
        return node.model.rig?.ik?.some(chain => chain.id === chainId)
          ? removeIkChain(node.id, chainId)
          : null
      }),
    ),

  'animation.add': input => Promise.resolve(addAnimation(input)),

  'animation.remove': input =>
    Promise.resolve(
      editModelOf(input, node => {
        const clipId = textOf(input, 'clipId') ?? ''
        return node.model.lanes?.some(lane => lane.clips.some(clip => clip.id === clipId))
          ? removeModelClip(node.id, clipId)
          : null
      }),
    ),

  'animation.settings': input => Promise.resolve(timelineSettings(input)),

  'animation.autoKey': input => {
    const documentId = activeSceneId(useDocuments.getState())
    if (documentId === null) return Promise.resolve(refused('wrongSurface'))

    useAnimationViews.getState().setAutoKey(documentId, boolOf(input, 'on'))
    return Promise.resolve({ ok: true })
  },
}
