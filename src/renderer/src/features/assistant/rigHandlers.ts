import { DIRECT_PROPERTIES, type AnimationTrack } from '@shared/domain/animation'
import { refused, type ActionOutcome } from '@shared/domain/assistant'
import {
  BODY_PARTS,
  HUMANOID_ROLES,
  type BodyPart,
  type HumanoidRole,
} from '@shared/domain/humanoid'
import { speaksBundle } from '@/helpers/speaksBundle'
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
  unkeySubjectWholly,
} from '@/engines/scene/animationCommands'
import { clampPlayhead } from '@/engines/scene/animationEval'
import { clipsEdited, clipsMoved, laneHolding, lanesWith } from '@/engines/scene/clipBlend'
import { channelNames } from '@/helpers/channelNames'
import { sceneKeyingAt } from '@/helpers/sceneKeyingAt'
import {
  addIkChain,
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
import { clipsOfNode, rigOfNode, useModelFiles } from '@/stores/modelFiles'
import { laySceneClip, sceneOf, useScenes, writeAnimationTrack } from '@/stores/scenes'
import { type ActionHandlers } from './actionHandler'
import { NO_SCENE } from './sceneHandlers'
import { boolOf, maybeBoolOf, numberOf, oneOf, textOf } from './actionInputs'
import { nodeAimed } from './nodeAimed'

/**
 * The skeleton of a character, the handles its joints reach for, and the blocks laid on its band.
 * Every edit runs the command the inspector runs, so ⌘Z takes it back. Nothing is rebuilt here.
 */

/** The 3D tab in front and the model named in it, or nothing — which reads as `wrongSurface`. */
function model(input: Record<string, unknown>): { documentId: string; node: ModelNode } | null {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return null

  const node = nodeAimed(sceneOf(useScenes.getState(), documentId), textOf(input, 'nodeId') ?? '')
  return node?.type === 'model' ? { documentId, node } : null
}

/**
 * Why `model` answered nothing — the scene is not in front, or the node named is not a model.
 *
 * 🛑 One refusal for both sent the model repairing what was not broken: measured on the bench
 * pass of 2026-08-25, `animations.list` aimed at a sphere answered `wrongSurface` sixteen times
 * while the scene WAS in front, and the model kept re-activating the document.
 */
function noModel(input: Record<string, unknown>): ActionOutcome {
  return activeSceneId(useDocuments.getState()) === null
    ? refused('wrongSurface', NO_SCENE)
    : refused(
        'notFound',
        `no model node "${textOf(input, 'nodeId') ?? ''}" in the scene in front — scene.state answers "nodes", and only the ones of type "model" carry a rig or a band`,
      )
}

/** Runs one command on the model named, refusing before it rather than writing nothing. */
function editModelOf(
  input: Record<string, unknown>,
  build: (node: ModelNode, documentId: string) => Command<SceneState> | null,
  /** What a caller does when the model IS there and the build still declines. */
  nothing: string,
): ActionOutcome {
  const open = model(input)
  if (!open) return noModel(input)

  const command = build(open.node, open.documentId)
  if (!command) return refused('notFound', nothing)

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
  if (!open) return noModel(input)

  const bounds = rigOfNode(useModelFiles.getState(), open.documentId, open.node.id)?.bounds
  if (!bounds)
    return refused(
      'notFound',
      'the studio has not measured this model yet — rig.state answers "status"; wait for it to read the file, then send this again',
    )

  const fault = rigFitFaultOf(bounds)
  if (fault)
    return refused(
      'failed',
      fault === 'noGeometry'
        ? 'this model measures too small to lay bones in — it carries no geometry the studio can fit a rig to'
        : 'this model lies down, and a rig is proportioned off the height — stand it up with node.transform, then send this again',
    )

  useScenes.getState().runCommand(open.documentId, setModelRig(open.node.id, rigFit(bounds)))
  return { ok: true }
}

/** What the panels read off a character: its bones, their roles, its handles and its blocks. */
function rigState(input: Record<string, unknown>): ActionOutcome {
  const open = model(input)
  if (!open) return noModel(input)

  const rig = open.node.model.rig
  return {
    ok: true,
    data: {
      rigged: rig !== undefined,
      bones: rig?.bones ?? [],
      ik: rig?.ik ?? [],
      lanes: open.node.model.lanes ?? [],
      // What the engine measured, which is what decides whether a bare mesh can be rigged at all.
      status: rigOfNode(useModelFiles.getState(), open.documentId, open.node.id)?.status ?? null,
    },
  }
}

// The asset's kind is checked as `addAnimationTo` checks it: a mesh laid on a band would be a
// block that plays nothing.
async function addAnimation(input: Record<string, unknown>): Promise<ActionOutcome> {
  const source = oneOf(input, 'source', CLIP_SOURCES) ?? 'asset'
  const assetId = textOf(input, 'assetId')
  const clipName = textOf(input, 'clipName')

  if (source === 'asset') {
    if (clipName !== null || assetId === null)
      return refused('badInput', 'source "asset" wants "assetId" and no "clipName"')

    const asset = assetsById(useAssets.getState()).get(assetId)
    if (!asset)
      return refused(
        'notFound',
        `no asset "${assetId}" in this library — assets.searchProjectCatalogue answers what is in it`,
      )
    if (asset.type !== 'animation')
      return refused(
        'badInput',
        `asset "${assetId}" is of type "${asset.type}", and a block wants one of type "animation" — assets.searchProjectCatalogue with type "animation" answers which are`,
      )

    return layBlockOf(input, assetClip(newId(), asset.id, asset.name))
  }

  if (assetId !== null || clipName === null)
    return refused('badInput', `source "${source}" wants "clipName" and no "assetId"`)

  // Read against what the model can actually play, so a name its file does not spell is a refusal
  // rather than a block that stands on the band and plays nothing.
  const open = model(input)
  if (!open) return noModel(input)
  const playable =
    source === 'embedded'
      ? clipsOfNode(useModelFiles.getState(), open.documentId, open.node.id)
      : await bundledNames()

  if (!playable.includes(clipName))
    return refused(
      'notFound',
      `"${clipName}" is not among the "${source}" clips this model can play — animations.list answers "embedded" and "bundled" by name`,
    )

  return layBlockOf(
    input,
    source === 'embedded' ? embeddedClip(newId(), clipName) : bundledClip(newId(), clipName),
  )
}

/** Laid through the very gesture the panels use, so a block an assistant lays lands CHOSEN too. */
function layBlockOf(input: Record<string, unknown>, clip: ClipRef): ActionOutcome {
  const open = model(input)
  if (!open) return noModel(input)

  laySceneClip(open.documentId, open.node.id, clip)
  return { ok: true }
}

/** The animations shipped with the app, by folder — the picker's own second list. */
async function bundledNames(): Promise<readonly string[]> {
  const shipped = (await getBridge()?.animations.list()) ?? []
  return shipped.map(animation => animation.name)
}

async function listAnimations(input: Record<string, unknown>): Promise<ActionOutcome> {
  const open = model(input)
  if (!open) return noModel(input)

  return {
    ok: true,
    data: {
      embedded: clipsOfNode(useModelFiles.getState(), open.documentId, open.node.id),
      bundled: await bundledNames(),
      assets: [...assetsById(useAssets.getState()).values()]
        .filter(asset => asset.type === 'animation')
        .map(asset => ({ id: asset.id, name: asset.name })),
      // What is already laid, so a client can settle or take one back without a second read.
      lanes: open.node.model.lanes ?? [],
    },
  }
}

// Rewritten IN PLACE inside its own lane, as the inspector does it: a block reordered because a
// speed changed would move on screen.
function editBlock(input: Record<string, unknown>): ActionOutcome {
  const fade = numberOf(input, 'fadeSeconds')
  const start = numberOf(input, 'startSeconds')
  const offset = numberOf(input, 'offsetSeconds')
  const speed = numberOf(input, 'speed')
  const rootMotion = oneOf(input, 'rootMotion', ROOT_MOTIONS)
  const part: BodyPart | null = oneOf(input, 'part', BODY_PARTS)

  const loop = maybeBoolOf(input, 'loop')
  const patch: Partial<ClipRef> = {
    ...(offset === null ? {} : { offset }),
    ...(speed === null ? {} : { speed }),
    ...(loop === null ? {} : { loop }),
    ...(fade === null ? {} : { fadeIn: secondsToUs(fade), fadeOut: secondsToUs(fade) }),
    ...(rootMotion === null ? {} : { rootMotion }),
    ...(part === null ? {} : { part }),
  }
  if (start === null && Object.keys(patch).length === 0)
    return refused(
      'badInput',
      'this call named nothing to write on the block: startSeconds, offsetSeconds, speed, loop, fadeSeconds, rootMotion or part',
    )

  return editModelOf(
    input,
    (node, documentId) => {
      const lanes = node.model.lanes ?? []
      const clipId = textOf(input, 'clipId') ?? ''
      const holding = laneHolding(lanes, clipId)
      if (!holding) return null

      // Where the band can actually reach, as a drag lands it: a block posed off a frame plays a
      // pose the head never stops on, and one past the end sits where it can never be grabbed back.
      const band = sceneOf(useScenes.getState(), documentId).animation
      const at =
        start === null
          ? null
          : clampPlayhead(snapToFrame(secondsToUs(start), band.fps), band.duration)

      const written = lanesWith(lanes, holding.id, clips => {
        const moved = at === null ? clips : (clipsMoved(clips, clipId, at) ?? clips)
        return Object.keys(patch).length === 0
          ? at === null || moved === clips
            ? null
            : moved
          : clipsEdited(moved, clipId, clip => ({ ...clip, ...patch }))
      })

      return written ? setModelLanes(node.id, written) : null
    },
    '"clipId" names no block on this model\'s lanes, or the call would move it nowhere — animations.list answers "lanes" with the clips on them',
  )
}

function timelineSettings(input: Record<string, unknown>): ActionOutcome {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return refused('wrongSurface', NO_SCENE)

  const seconds = numberOf(input, 'durationSeconds')
  const fps = numberOf(input, 'fps')
  if (seconds === null && fps === null)
    return refused(
      'badInput',
      'this call named neither "durationSeconds" nor "fps", and one of the two is what it writes',
    )

  useScenes.getState().runCommand(
    documentId,
    setTimelineSettings({
      ...(seconds === null ? {} : { duration: secondsToUs(seconds) }),
      ...(fps === null ? {} : { fps }),
    }),
  )
  return { ok: true }
}

/** A key lands on a frame or on nothing: one laid between two is one nothing reads back. */
function frameAt(state: SceneState, seconds: number): Us {
  return snapToFrame(secondsToUs(seconds), state.animation.fps)
}

/** Runs a command built from the instant a key lands on, the head where none was named. */
function editKeys(
  input: Record<string, unknown>,
  build: (open: { state: SceneState; at: Us }) => Command<SceneState> | null,
  /** What a caller does when the scene IS in front and the build still declines. */
  nothing: string,
): ActionOutcome {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return refused('wrongSurface', NO_SCENE)

  const keying = sceneKeyingAt(documentId)
  const seconds = numberOf(input, 'timeSeconds')
  const command = build({
    state: keying.state,
    at: seconds === null ? keying.at : frameAt(keying.state, seconds),
  })
  if (!command) return refused('badInput', nothing)

  useScenes.getState().runCommand(documentId, command)
  return { ok: true }
}

/** The channel a call names, on the scene in front — an id nobody answers to is a refusal. */
function editTrack(
  input: Record<string, unknown>,
  build: (track: AnimationTrack, documentId: string) => ActionOutcome,
): ActionOutcome {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return refused('wrongSurface', NO_SCENE)

  const trackId = textOf(input, 'trackId') ?? ''
  const track = sceneOf(useScenes.getState(), documentId).animation.tracks.find(
    held => held.id === trackId,
  )

  return track
    ? build(track, documentId)
    : refused(
        'notFound',
        `no channel "${trackId}" on the scene in front — scene.state answers "tracks" with their ids`,
      )
}

/** The subject a call names: a node of the scene, or one bone of the model it holds. */
function subjectOf(input: Record<string, unknown>): { nodeId: string; bone?: string } {
  const bone = textOf(input, 'bone')
  const nodeId = textOf(input, 'nodeId') ?? ''
  return bone === null ? { nodeId } : { nodeId, bone }
}

/** Its channels, by id — locked ones left out, as every gesture of the band leaves them out. */
function tracksOfSubject(state: SceneState, subject: { nodeId: string; bone?: string }): string[] {
  return recordingTracksFor(state.animation, subject.nodeId, subject.bone).map(track => track.id)
}

/**
 * A channel name is screen text, and one opened from outside must read like one opened by the
 * diamond. `i18next` answers nothing before a window has initialised it — a test — so the English
 * line stands in, never `undefined` written into a document.
 */
function keyPose(input: Record<string, unknown>): ActionOutcome {
  const only = oneOf(input, 'property', DIRECT_PROPERTIES) ?? undefined

  return editKeys(
    input,
    ({ state, at }) => {
      const subject = subjectOf(input)
      const node = nodeById(state, subject.nodeId)
      if (!node) return null

      return keyNode(
        state,
        subject,
        at,
        channelNames(speaksBundle(), subject.bone ?? node.name),
        () => `track_${newId()}`,
        only,
      )
    },
    '"nodeId" must name a node of the scene in front, and "bone" one of its rig — scene.state answers "nodes", rig.state answers "bones"',
  )
}

export const RIG_HANDLERS: ActionHandlers = {
  'rig.state': rigState,
  'rig.fit': fitRig,
  'rig.clear': input =>
    editModelOf(
      input,
      node => setModelRig(node.id, null),
      'this model carries no rig to clear — rig.state answers "rigged", and rig.fit builds one',
    ),
  'rig.hands': input =>
    editModelOf(
      input,
      node => addRigHands(node.id),
      'this model carries no rig to add hands to — rig.fit builds one first, and rig.state answers "rigged"',
    ),

  'bone.add': input =>
    editModelOf(
      input,
      node => {
        const parent = boneOf(node, textOf(input, 'parent'))
        return parent === null
          ? null
          : addRigBone(node.id, childBone(node.model.rig?.bones ?? [], parent))
      },
      '"parent" must name a bone of this model\'s rig — rig.state answers "bones" with their names',
    ),

  'bone.remove': input =>
    editModelOf(
      input,
      node => {
        const bone = boneOf(node, textOf(input, 'bone'))
        return bone === null ? null : removeRigBone(node.id, bone)
      },
      '"bone" must name a bone of this model\'s rig — rig.state answers "bones" with their names',
    ),

  'bone.rename': input =>
    editModelOf(
      input,
      node => {
        const bone = boneOf(node, textOf(input, 'bone'))
        const name = textOf(input, 'name') ?? ''
        // A name already taken is refused here rather than by the command, which writes nothing for
        // a duplicate — and a client told `ok` would believe the rename took.
        return bone === null || node.model.rig?.bones.some(one => one.name === name)
          ? null
          : renameRigBone(node.id, bone, name)
      },
      '"bone" must name a bone of this model\'s rig and "name" must be free of the others — rig.state answers "bones"',
    ),

  'bone.role': input =>
    editModelOf(
      input,
      node => {
        const bone = boneOf(node, textOf(input, 'bone'))
        const role: HumanoidRole | null = oneOf(input, 'role', HUMANOID_ROLES)
        return bone === null ? null : setRigBoneRole(node.id, bone, role)
      },
      '"bone" must name a bone of this model\'s rig — rig.state answers "bones" with their names',
    ),

  'ik.add': input =>
    editModelOf(
      input,
      node => {
        const bone = boneOf(node, textOf(input, 'bone'))
        return bone === null ? null : addIkChain(node.id, bone)
      },
      '"bone" must name a bone of this model\'s rig — rig.state answers "bones" with their names',
    ),

  'ik.remove': input =>
    editModelOf(
      input,
      node => {
        const chainId = textOf(input, 'chainId') ?? ''
        return node.model.rig?.ik?.some(chain => chain.id === chainId)
          ? removeIkChain(node.id, chainId)
          : null
      },
      '"chainId" must name a handle of this model — rig.state answers "ik" with their ids',
    ),

  'animations.list': listAnimations,
  'animation.addBlock': addAnimation,
  'animation.setBlockSettings': editBlock,

  'animation.removeBlock': input =>
    editModelOf(
      input,
      node => {
        const clipId = textOf(input, 'clipId') ?? ''
        return node.model.lanes?.some(lane => lane.clips.some(clip => clip.id === clipId))
          ? removeModelClip(node.id, clipId)
          : null
      },
      '"clipId" names no block laid on this model — animations.list answers "lanes" with the clips on them',
    ),

  'animation.setBandLengthAndRate': timelineSettings,

  'animation.autoKey': input => {
    const documentId = activeSceneId(useDocuments.getState())
    if (documentId === null) return refused('wrongSurface', NO_SCENE)

    useAnimationViews.getState().setAutoKey(documentId, boolOf(input, 'on'))
    return { ok: true }
  },

  'key.writePoseKeys': keyPose,

  /**
   * 🛑 No instant named clears them ALL, and that is the difference from the window's own diamond:
   * a client cannot see the playhead, so « efface toutes les clés » had no call to make.
   */
  'key.removeSubjectKeys': input =>
    editKeys(
      input,
      ({ state, at }) => {
        const tracks = tracksOfSubject(state, subjectOf(input))
        return numberOf(input, 'timeSeconds') === null
          ? unkeySubjectWholly(state, tracks)
          : unkeySubject(state, tracks, at)
      },
      'nothing is keyed for that subject, or nothing at that instant — scene.state answers "tracks" with the instants each channel holds',
    ),

  'key.writeKeysOnOpenChannels': input =>
    editKeys(
      input,
      ({ state, at }) =>
        keySubject(
          state,
          state.animation.tracks.map(track => track.id),
          at,
        ),
      'the scene in front holds no channel to key — key.writePoseKeys opens one on a node first',
    ),

  'key.move': input =>
    editTrack(input, (track, documentId) => {
      const state = sceneOf(useScenes.getState(), documentId)
      const from = frameAt(state, numberOf(input, 'fromSeconds') ?? 0)

      // Nothing standing where the drag began: the command hands the state back untouched, which
      // without this reads as a key moved.
      if (!track.keys.some(key => key.time === from))
        return refused(
          'badInput',
          'that channel holds no key at "fromSeconds" — scene.state answers "tracks" with the instants each one holds, in microseconds',
        )

      const to = frameAt(state, numberOf(input, 'toSeconds') ?? 0)
      useScenes.getState().runCommand(documentId, moveAnimationKey(track.id, from, to))
      return { ok: true }
    }),

  'channel.remove': input =>
    editTrack(input, (track, documentId) => {
      // A locked channel is skipped by the command, which reads as removed.
      if (track.locked)
        return refused(
          'badInput',
          'that channel is locked — channel.setMuteSoloLock with locked false unlocks it, then send this again',
        )

      useScenes.getState().runCommand(documentId, removeAnimationTrack(track.id))
      return { ok: true }
    }),

  'channel.setMuteSoloLock': input =>
    editTrack(input, (track, documentId) => {
      const flags = {
        ...flagNamed(input, 'muted'),
        ...flagNamed(input, 'solo'),
        ...flagNamed(input, 'locked'),
      }
      if (Object.keys(flags).length === 0)
        return refused('badInput', 'this call named none of muted, solo, locked')

      writeAnimationTrack(documentId, track.id, held => ({ ...held, ...flags }))
      return { ok: true }
    }),
}

/** One flag of a channel, or nothing at all — the difference `boolOf` alone cannot carry. */
function flagNamed(input: Record<string, unknown>, key: string): Record<string, boolean> {
  const value = maybeBoolOf(input, key)
  return value === null ? {} : { [key]: value }
}
