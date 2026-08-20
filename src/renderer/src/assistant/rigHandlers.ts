import i18next from 'i18next'
import { TRACK_PROPERTIES, type TrackProperty } from '@shared/domain/animation'
import { refused, type ActionOutcome } from '@shared/domain/assistant'
import {
  BODY_PARTS,
  HUMANOID_ROLES,
  type BodyPart,
  type HumanoidRole,
} from '@shared/domain/humanoid'
import { englishText } from '@shared/i18n'
import { childBone } from '@shared/domain/rig'
import {
  assetClip,
  bundledClip,
  CLIP_SOURCES,
  embeddedClip,
  ROOT_MOTIONS,
  type ClipRef,
} from '@shared/domain/scene'
import { secondsToUs, snapToFrame, type Us } from '@shared/domain/time'
import {
  keyNode,
  keySubject,
  moveAnimationKey,
  recordingTracksFor,
  removeAnimationTrack,
  setTimelineSettings,
  unkeySubject,
} from '@/engines/scene/animationCommands'
import { laneHolding, lanesWith } from '@/engines/scene/clipBlend'
import { channelNames } from '@/helpers/channelNames'
import { sceneKeyingAt } from '@/helpers/sceneKeyingAt'
import {
  addIkChain,
  addModelClip,
  addRigBone,
  addRigHands,
  removeIkChain,
  removeModelClip,
  removeRigBone,
  renameRigBone,
  setModelLanes,
  setModelRig,
  setRigBoneRole,
} from '@/engines/scene/commands'
import type { Command } from '@/engines/core/history'
import { rigFit, rigFitFaultOf } from '@/engines/scene/rigFit'
import { nodeById, type ModelNode, type SceneState } from '@/engines/scene/sceneState'
import { newId } from '@/helpers/ids'
import { assetsById, useAssets } from '@/stores/assets'
import { useAnimationViews } from '@/stores/animationView'
import { getBridge } from '@/services/bridge'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { clipsOfNode, rigOfNode, useModelClips } from '@/stores/modelClips'
import { sceneOf, useScenes, writeAnimationTrack } from '@/stores/scenes'
import { type ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, textOf } from './actionInputs'

/**
 * The skeleton of a character, the handles its joints reach for, and the blocks laid on its band.
 * Every edit runs the command the inspector runs, so ⌘Z takes it back. Nothing is rebuilt here.
 */

/** The 3D tab in front and the model named in it, or nothing — which reads as `wrongSurface`. */
function model(input: Record<string, unknown>): { documentId: string; node: ModelNode } | null {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return null

  const node = nodeById(sceneOf(useScenes.getState(), documentId), textOf(input, 'nodeId') ?? '')
  return node?.type === 'model' ? { documentId, node } : null
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
 * The skeleton the studio fits to the mesh it has measured. `null` bounds mean the engine has not
 * read the model yet, which is a wait rather than a fault.
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

/**
 * A block on the band, from any of the three places a motion comes from.
 *
 * `assetId` belongs to a clip of the library and `clipName` to the two others, so naming both — or
 * the wrong one for the source — is refused rather than half read. An asset's kind is checked as
 * `addAnimationTo` checks it: a mesh laid on a band would be a block that plays nothing.
 */
async function addAnimation(input: Record<string, unknown>): Promise<ActionOutcome> {
  const source = oneOf(input, 'source', CLIP_SOURCES) ?? 'asset'
  const assetId = textOf(input, 'assetId')
  const clipName = textOf(input, 'clipName')

  if (source === 'asset') {
    if (clipName !== null || assetId === null) return refused('badInput')

    const asset = assetsById(useAssets.getState()).get(assetId)
    if (!asset) return refused('notFound')
    if (asset.type !== 'animation') return refused('badInput')

    return editModelOf(input, node =>
      addModelClip(node.id, assetClip(newId(), asset.id, asset.name)),
    )
  }

  if (assetId !== null || clipName === null) return refused('badInput')

  // Read against what the model can actually play, so a name its file does not spell is a refusal
  // rather than a block that stands on the band and plays nothing.
  const open = model(input)
  if (!open) return refused('wrongSurface')
  const playable =
    source === 'embedded'
      ? clipsOfNode(useModelClips.getState(), open.documentId, open.node.id)
      : await bundledNames()

  if (!playable.includes(clipName)) return refused('notFound')

  return editModelOf(input, node =>
    addModelClip(
      node.id,
      source === 'embedded' ? embeddedClip(newId(), clipName) : bundledClip(newId(), clipName),
    ),
  )
}

/** The animations shipped with the app, by folder — the picker's own second list. */
async function bundledNames(): Promise<readonly string[]> {
  const shipped = (await getBridge()?.animations.list()) ?? []
  return shipped.map(animation => animation.name)
}

async function listAnimations(input: Record<string, unknown>): Promise<ActionOutcome> {
  const open = model(input)
  if (!open) return refused('wrongSurface')

  return {
    ok: true,
    data: {
      embedded: clipsOfNode(useModelClips.getState(), open.documentId, open.node.id),
      bundled: await bundledNames(),
      assets: [...assetsById(useAssets.getState()).values()]
        .filter(asset => asset.type === 'animation')
        .map(asset => ({ id: asset.id, name: asset.name })),
      // What is already laid, so a client can settle or take one back without a second read.
      lanes: open.node.model.lanes ?? [],
    },
  }
}

/**
 * One block of the band rewritten IN PLACE, inside its own lane — the inspector's own rule: every
 * other lane is carried over, and a block reordered because a speed changed would move on screen.
 */
function editBlock(input: Record<string, unknown>): ActionOutcome {
  const fade = numberOf(input, 'fadeSeconds')
  const start = numberOf(input, 'startSeconds')
  const offset = numberOf(input, 'offsetSeconds')
  const speed = numberOf(input, 'speed')
  const rootMotion = oneOf(input, 'rootMotion', ROOT_MOTIONS)
  const part: BodyPart | null = oneOf(input, 'part', BODY_PARTS)

  return editModelOf(input, node => {
    const lanes = node.model.lanes ?? []
    const clipId = textOf(input, 'clipId') ?? ''
    const holding = laneHolding(lanes, clipId)
    if (!holding) return null

    const written: readonly ClipRef[] = holding.clips.map(clip =>
      clip.id !== clipId
        ? clip
        : {
            ...clip,
            ...(start === null ? {} : { start: secondsToUs(start) }),
            ...(offset === null ? {} : { offset }),
            ...(speed === null ? {} : { speed }),
            ...(input.loop === undefined ? {} : { loop: boolOf(input, 'loop') }),
            ...(fade === null ? {} : { fadeIn: secondsToUs(fade), fadeOut: secondsToUs(fade) }),
            ...(rootMotion === null ? {} : { rootMotion }),
            ...(part === null ? {} : { part }),
          },
    )

    const lanesWritten = lanesWith(lanes, holding.id, () => written)
    return lanesWritten ? setModelLanes(node.id, lanesWritten) : null
  })
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

/** The scene in front, the instant a key lands on, and the state to measure it against. */
function keyingAt(
  input: Record<string, unknown>,
): { documentId: string; state: SceneState; at: Us } | null {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return null

  const keying = sceneKeyingAt(documentId)
  const seconds = numberOf(input, 'timeSeconds')

  return {
    documentId,
    state: keying.state,
    // The head where nothing was named, snapped as the band snaps it: a key laid between two
    // frames is a key nothing reads back.
    at:
      seconds === null ? keying.at : snapToFrame(secondsToUs(seconds), keying.state.animation.fps),
  }
}

/** Runs a command built from the instant a key lands on, or refuses. */
function editKeys(
  input: Record<string, unknown>,
  build: (open: { state: SceneState; at: Us }) => Command<SceneState> | null,
): ActionOutcome {
  const open = keyingAt(input)
  if (!open) return refused('wrongSurface')

  const command = build(open)
  if (!command) return refused('badInput')

  useScenes.getState().runCommand(open.documentId, command)
  return { ok: true }
}

/** The channels of one subject — the node itself, or one bone of the model it holds. */
function tracksOfSubject(
  state: SceneState,
  input: Record<string, unknown>,
  property: TrackProperty | null,
): string[] {
  return recordingTracksFor(
    state.animation,
    textOf(input, 'nodeId') ?? '',
    textOf(input, 'bone') ?? undefined,
  )
    .filter(track => property === null || track.target.property === property)
    .map(track => track.id)
}

/**
 * One key on every channel of a subject, opening the ones it lacks.
 *
 * The names are the band's own, and they are screen text: a channel opened from outside must read
 * like one opened by the diamond. `i18next` answers nothing before a window has initialised it —
 * a test — and the English line is what stands in, never `undefined` written into a document.
 */
function keyPose(input: Record<string, unknown>): ActionOutcome {
  const property: TrackProperty | null = oneOf(input, 'property', TRACK_PROPERTIES)

  return editKeys(input, ({ state, at }) => {
    const nodeId = textOf(input, 'nodeId') ?? ''
    const bone = textOf(input, 'bone') ?? undefined
    const node = nodeById(state, nodeId)
    if (!node) return null

    // Narrowed to one channel: `keyNode` opens every property a subject can hold, which is what
    // the diamond does — a client naming one writes on that one alone.
    if (property !== null) {
      const held = tracksOfSubject(state, input, property)
      return held.length === 0 ? null : keySubject(state, held, at)
    }

    return keyNode(
      state,
      bone === undefined ? { nodeId } : { nodeId, bone },
      at,
      channelNames(key => i18next.t(key) || englishText(key), bone ?? node.name),
      () => `track_${newId()}`,
    )
  })
}

export const RIG_HANDLERS: ActionHandlers = {
  'rig.state': rigState,
  'rig.fit': fitRig,
  'rig.clear': input => editModelOf(input, node => setModelRig(node.id, null)),
  'rig.hands': input => editModelOf(input, node => addRigHands(node.id)),

  'bone.add': input =>
    editModelOf(input, node => {
      const parent = boneOf(node, textOf(input, 'parent'))
      return parent === null
        ? null
        : addRigBone(node.id, childBone(node.model.rig?.bones ?? [], parent))
    }),

  'bone.remove': input =>
    editModelOf(input, node => {
      const bone = boneOf(node, textOf(input, 'bone'))
      return bone === null ? null : removeRigBone(node.id, bone)
    }),

  'bone.rename': input =>
    editModelOf(input, node => {
      const bone = boneOf(node, textOf(input, 'bone'))
      const name = textOf(input, 'name') ?? ''
      // A name already taken is refused here rather than by the command, which writes nothing for
      // a duplicate — and a client told `ok` would believe the rename took.
      return bone === null || node.model.rig?.bones.some(one => one.name === name)
        ? null
        : renameRigBone(node.id, bone, name)
    }),

  'bone.role': input =>
    editModelOf(input, node => {
      const bone = boneOf(node, textOf(input, 'bone'))
      const role: HumanoidRole | null = oneOf(input, 'role', HUMANOID_ROLES)
      return bone === null ? null : setRigBoneRole(node.id, bone, role)
    }),

  'ik.add': input =>
    editModelOf(input, node => {
      const bone = boneOf(node, textOf(input, 'bone'))
      return bone === null ? null : addIkChain(node.id, bone)
    }),

  'ik.remove': input =>
    editModelOf(input, node => {
      const chainId = textOf(input, 'chainId') ?? ''
      return node.model.rig?.ik?.some(chain => chain.id === chainId)
        ? removeIkChain(node.id, chainId)
        : null
    }),

  'animations.list': listAnimations,
  'animation.add': addAnimation,
  'animation.block': editBlock,

  'animation.remove': input =>
    editModelOf(input, node => {
      const clipId = textOf(input, 'clipId') ?? ''
      return node.model.lanes?.some(lane => lane.clips.some(clip => clip.id === clipId))
        ? removeModelClip(node.id, clipId)
        : null
    }),

  'animation.settings': timelineSettings,

  'animation.autoKey': input => {
    const documentId = activeSceneId(useDocuments.getState())
    if (documentId === null) return refused('wrongSurface')

    useAnimationViews.getState().setAutoKey(documentId, boolOf(input, 'on'))
    return { ok: true }
  },

  'key.pose': keyPose,

  'key.clear': input =>
    editKeys(input, ({ state, at }) =>
      unkeySubject(state, tracksOfSubject(state, input, null), at),
    ),

  'key.all': input =>
    editKeys(input, ({ state, at }) =>
      keySubject(
        state,
        state.animation.tracks.map(track => track.id),
        at,
      ),
    ),

  'key.move': input =>
    editKeys(input, ({ state }) => {
      const trackId = textOf(input, 'trackId') ?? ''
      const track = state.animation.tracks.find(held => held.id === trackId)
      const from = numberOf(input, 'fromSeconds') ?? 0
      const to = numberOf(input, 'toSeconds') ?? 0
      if (!track) return null

      const at = (seconds: number): Us => snapToFrame(secondsToUs(seconds), state.animation.fps)
      // Nothing standing where the drag began: the command hands the state back untouched, which
      // without this reads as a key moved.
      return track.keys.some(key => key.time === at(from))
        ? moveAnimationKey(trackId, at(from), at(to))
        : null
    }),

  'channel.remove': input => {
    const documentId = activeSceneId(useDocuments.getState())
    if (documentId === null) return refused('wrongSurface')

    const trackId = textOf(input, 'trackId') ?? ''
    const track = sceneOf(useScenes.getState(), documentId).animation.tracks.find(
      held => held.id === trackId,
    )
    // A locked channel is skipped by the command, which reads as removed.
    if (!track || track.locked) return refused('badInput')

    useScenes.getState().runCommand(documentId, removeAnimationTrack(trackId))
    return { ok: true }
  },

  'channel.flags': input => {
    const documentId = activeSceneId(useDocuments.getState())
    if (documentId === null) return refused('wrongSurface')

    const trackId = textOf(input, 'trackId') ?? ''
    const state = sceneOf(useScenes.getState(), documentId)
    if (!state.animation.tracks.some(held => held.id === trackId)) return refused('notFound')

    const flags = {
      ...(input.muted === undefined ? {} : { muted: boolOf(input, 'muted') }),
      ...(input.solo === undefined ? {} : { solo: boolOf(input, 'solo') }),
      ...(input.locked === undefined ? {} : { locked: boolOf(input, 'locked') }),
    }
    if (Object.keys(flags).length === 0) return refused('badInput')

    writeAnimationTrack(documentId, trackId, track => ({ ...track, ...flags }))
    return { ok: true }
  },
}
