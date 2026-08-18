import {
  POSE_PROPERTIES,
  TRACK_PROPERTIES,
  type AnimationTrack,
  type CameraMotion,
  type CameraShot,
  type Keyframe,
  type TrackProperty,
  type TrackTarget,
} from '@shared/domain/animation'
import type { Transform, Vector3 } from '@shared/domain/scene'
import type { Us } from '@shared/domain/time'
import type { Command } from '../core/history'
import { addNode, moveNodes, multi } from './commands'
import { pathNode } from './nodeFactory'
import { deltaOf, valueAt, withKey, withoutKey } from './animationEval'
import { nodeById, type CameraNode, type NodeMove, type SceneState } from './sceneState'

/**
 * Edits of the timeline, on the pattern of the sequence's own track commands: what a command
 * needs to revert is captured as it is APPLIED, never as it is built.
 *
 * They are separate from `commands.ts` because they touch one field of the state and none of the
 * nodes — and because a timeline edit that reached into a node would be the thing this whole
 * additive design exists to avoid.
 */

const write = (
  state: SceneState,
  change: (tracks: readonly AnimationTrack[]) => AnimationTrack[],
): SceneState => ({
  ...state,
  animation: { ...state.animation, tracks: rowIndexed(change(state.animation.tracks)) },
})

/**
 * Row order read back from position, so the array and the numbers cannot drift apart.
 *
 * NOT `reindexTracks` of the montage, which reads a DEPTH — there the first row is drawn last, so
 * its number is the highest. Here the tracks add up and none hides another: the number is the row.
 */
const rowIndexed = (tracks: readonly AnimationTrack[]): AnimationTrack[] =>
  tracks.map((track, position) => ({ ...track, index: position }))

/**
 * One track rewritten, as a pure function of the state. Exported because the flags of a track —
 * muted, solo, locked, armed — are how one WORKS rather than what one made: they go through the
 * store without an entry in the history, exactly as a montage's do.
 */
export const updateAnimationTrack = (
  state: SceneState,
  trackId: string,
  change: (track: AnimationTrack) => AnimationTrack,
): SceneState =>
  write(state, tracks => tracks.map(track => (track.id === trackId ? change(track) : track)))

const editTrack = updateAnimationTrack

const trackById = (state: SceneState, trackId: string): AnimationTrack | undefined =>
  state.animation.tracks.find(track => track.id === trackId)

/**
 * Adds a track for one property of one target. The id is minted with the command rather than
 * inside `apply`: a redo must name the same track the undo took away, or nothing that referred
 * to it — an armed flag, a selection — finds it again.
 */
export function addAnimationTrack(
  target: TrackTarget,
  name: string,
  id: string,
): Command<SceneState> {
  return {
    id: `track:add:${id}`,
    apply: state =>
      write(state, tracks => [
        ...tracks,
        {
          id,
          name,
          index: tracks.length,
          muted: false,
          solo: false,
          locked: false,
          target,
          // Captured as it is APPLIED, like everything else here: the pose to measure keys
          // against is the one the object stands in now, not when the command was built.
          rest: target.bone ? undefined : nodeById(state, target.nodeId)?.transform,
          keys: [],
        },
      ]),
    revert: state => write(state, tracks => tracks.filter(track => track.id !== id)),
  }
}

export function removeAnimationTrack(trackId: string): Command<SceneState> {
  let before: { position: number; track: AnimationTrack } | null = null

  return {
    id: `track:remove:${trackId}`,
    apply: state => {
      const tracks = state.animation.tracks
      const position = tracks.findIndex(track => track.id === trackId)
      const track = tracks[position]
      if (!track || track.locked) return state

      before = { position, track }
      return write(state, current => current.filter(candidate => candidate.id !== trackId))
    },
    revert: state => {
      const origin = before
      if (!origin) return state
      return write(state, tracks => {
        const restored = [...tracks]
        restored.splice(origin.position, 0, origin.track)
        return restored
      })
    },
  }
}

/**
 * A command that rewrites the keys of ONE track and takes them back whole.
 *
 * Written once because setting, removing and moving a key had it spelt identically: the undo of
 * any of them is the list as it stood, and there is no cleverer inverse to find.
 *
 * Two ways for `next` to decline, and they are the same answer to the caller — the track is
 * missing or locked, or `next` itself returns null because what it was asked to move is no longer
 * there. In both cases the state is handed back untouched and `previous` stays null, which is
 * what makes the revert of a refused command a no-op rather than a restore of someone else's keys.
 */
function keysCommand(
  id: string,
  trackId: string,
  next: (keys: readonly Keyframe[]) => readonly Keyframe[] | null,
): Command<SceneState> {
  let previous: readonly Keyframe[] | null = null

  return {
    id,
    apply: state => {
      const track = trackById(state, trackId)
      if (!track || track.locked) return state

      const keys = next(track.keys)
      if (keys === null) return state

      previous = track.keys
      return editTrack(state, trackId, current => ({ ...current, keys }))
    },
    revert: state => {
      const origin = previous
      return origin === null
        ? state
        : editTrack(state, trackId, track => ({ ...track, keys: origin }))
    },
  }
}

/**
 * Writes a key at that instant, replacing whatever stood there.
 *
 * The value is a DELTA — what this track adds to the pose underneath — because tracks add up.
 * Whoever calls this has already worked out the difference between where the object is and where
 * it rests; the command is not the place to guess it.
 */
export function setAnimationKey(
  trackId: string,
  time: number,
  value: Vector3,
): Command<SceneState> {
  return keysCommand(`key:set:${trackId}`, trackId, keys => withKey(keys, { time, value }))
}

export function removeAnimationKey(trackId: string, time: number): Command<SceneState> {
  return keysCommand(`key:remove:${trackId}`, trackId, keys => withoutKey(keys, time))
}

/**
 * Keys an object that may hold no channel yet, creating the ones it lacks.
 *
 * This is `I → LocRotScale`: an object of a scene ALREADY EXISTS, so asking a person to create a
 * "track" before they can key it is asking them to build the thing they are looking at. The old
 * panel did exactly that, and read as empty with a cube standing in the viewport.
 *
 * Ids are minted here rather than inside `apply`, for the reason `addAnimationTrack` carries: a
 * redo must name the same channels the undo took away.
 */
/**
 * What a subject can be keyed on: the three of a pose, plus the lens when it is a camera and the
 * subject is the node itself.
 *
 * Read off the node rather than fixed, so keying a cube never opens a channel that drives
 * nothing — and a bone, which lives inside a file, has no lens of its own to open.
 */
export function keyableProperties(
  state: SceneState,
  subject: { nodeId: string; bone?: string },
): readonly TrackProperty[] {
  const camera = !subject.bone && nodeById(state, subject.nodeId)?.type === 'camera'
  return camera ? TRACK_PROPERTIES : POSE_PROPERTIES
}

export function keyNode(
  state: SceneState,
  subject: { nodeId: string; bone?: string },
  time: Us,
  names: Readonly<Record<TrackProperty, string>>,
  mintId: (property: TrackProperty) => string,
): Command<SceneState> | null {
  const held = recordingTracksFor(state, subject.nodeId, subject.bone)
  const missing = keyableProperties(state, subject).filter(
    property => !held.some(track => track.target.property === property),
  )

  const opened: Command<SceneState>[] = missing.map(property =>
    addAnimationTrack(
      subject.bone
        ? { nodeId: subject.nodeId, bone: subject.bone, property }
        : { nodeId: subject.nodeId, property },
      names[property],
      mintId(property),
    ),
  )

  // Applied first so the keys land on channels that exist: the state a command reads is the one
  // the commands before it produced, and `keySubject` reads the tracks by id.
  const opening = opened.reduce((current, command) => command.apply(current), state)
  const ids = recordingTracksFor(opening, subject.nodeId, subject.bone).map(track => track.id)

  const keys = keySubject(opening, ids, time)
  if (!keys) return opened.length === 0 ? null : multi('key:node', opened)

  return multi('key:node', [...opened, keys])
}

/**
 * A key on every channel of one subject, holding where the object STANDS right now.
 *
 * This is what a sheet's key button does — Blender spells it `LocRotScale` — and it is the whole
 * difference between a usable band and the one that wrote a neutral value: a key that holds
 * nothing moves nothing, so pressing the button appeared to do nothing at all.
 *
 * One command whatever the channel count, so a key costs one ⌘Z rather than three.
 */
export function keySubject(
  state: SceneState,
  trackIds: readonly string[],
  time: Us,
): Command<SceneState> | null {
  const writes: Command<SceneState>[] = []

  const moved: NodeMove[] = []

  for (const trackId of trackIds) {
    const track = trackById(state, trackId)
    if (!track || track.locked) continue

    const rest = track.rest
    const pose = rest ? nodeById(state, track.target.nodeId)?.transform : undefined

    if (rest && pose) {
      // The movement made since this channel opened becomes the key, and the object goes back to
      // the pose it is measured from. Without the second half the movement would be counted
      // twice — once in the object, once in the key laid over it.
      writes.push(setAnimationKey(trackId, time, deltaOf(rest, pose, track.target.property)))
      moved.push({ id: track.target.nodeId, transform: rest })
      continue
    }

    // A bone, whose rest pose only the renderer knows: it keeps what the channel already holds.
    writes.push(setAnimationKey(trackId, time, valueAt(track, time)))
  }

  if (writes.length === 0) return null
  if (moved.length > 0) writes.push(moveNodes(dedupeMoves(moved)))

  return writes.length === 1 && writes[0] ? writes[0] : multi('key:subject', writes)
}

/** One entry per node: three channels of one object all ask it back to the same pose. */
function dedupeMoves(moves: readonly NodeMove[]): NodeMove[] {
  const byId = new Map(moves.map(move => [move.id, move]))
  return [...byId.values()]
}

/**
 * Takes a key off every channel of one subject at that instant.
 *
 * The counterpart of `keySubject`, and it has to exist: a pose one cannot undo is a pose one is
 * stuck with, and the old panel's diamond removed what it had posed.
 */
export function unkeySubject(
  state: SceneState,
  trackIds: readonly string[],
  time: Us,
): Command<SceneState> | null {
  const drops = trackIds
    .map(trackId => trackById(state, trackId))
    .filter(track => track && !track.locked && track.keys.some(key => key.time === time))
    .map(track => removeAnimationKey(track!.id, time))

  if (drops.length === 0) return null
  return drops.length === 1 && drops[0] ? drops[0] : multi('key:unset', drops)
}

/**
 * Slides a key along its track, keeping its value.
 *
 * A key landing on an instant another already holds REPLACES it, which is what `withKey` does
 * everywhere else — two keys on one frame is a state no evaluation can read twice.
 */
export function moveAnimationKey(trackId: string, from: Us, to: Us): Command<SceneState> {
  return keysCommand(`key:move:${trackId}`, trackId, keys => {
    const moving = keys.find(key => key.time === from)
    // The key named is gone — dropped by another window between the grab and the release.
    return moving ? withKey(withoutKey(keys, from), { time: to, value: moving.value }) : null
  })
}

const writeShots = (
  state: SceneState,
  change: (shots: readonly CameraShot[]) => readonly CameraShot[],
): SceneState => ({
  ...state,
  animation: { ...state.animation, shots: change(state.animation.shots) },
})

/**
 * Puts a camera on air for a stretch of time. The shot arrives built, id included, for the same
 * reason a track does: a redo must name the shot the undo took away.
 */
export function addCameraShot(shot: CameraShot): Command<SceneState> {
  return {
    id: `shot:add:${shot.id}`,
    apply: state => writeShots(state, shots => [...shots, shot]),
    revert: state => writeShots(state, shots => shots.filter(held => held.id !== shot.id)),
  }
}

export function removeCameraShot(shotId: string): Command<SceneState> {
  let before: { position: number; shot: CameraShot } | null = null

  return {
    id: `shot:remove:${shotId}`,
    apply: state => {
      const position = state.animation.shots.findIndex(shot => shot.id === shotId)
      const shot = state.animation.shots[position]
      if (!shot) return state

      before = { position, shot }
      return writeShots(state, shots => shots.filter(held => held.id !== shotId))
    },
    revert: state => {
      const origin = before
      if (!origin) return state
      // Put back where it stood: two shots of one layer starting together are settled by their
      // order, so a shot restored at the end would come back on top of what it was under.
      return writeShots(state, shots => {
        const restored = [...shots]
        restored.splice(origin.position, 0, origin.shot)
        return restored
      })
    },
  }
}

/**
 * A shot moved, trimmed or sent to another layer — the three are one command because they are
 * one thing: the same shot with other bounds. Whichever fields are given are the ones written.
 */
export function editCameraShot(
  shotId: string,
  changes: Partial<Omit<CameraShot, 'id' | 'cameraId'>>,
): Command<SceneState> {
  let previous: CameraShot | null = null

  return {
    id: `shot:edit:${shotId}`,
    apply: state => {
      previous = state.animation.shots.find(shot => shot.id === shotId) ?? null
      return previous === null
        ? state
        : writeShots(state, shots =>
            shots.map(shot => (shot.id === shotId ? { ...shot, ...changes } : shot)),
          )
    },
    revert: state => {
      const origin = previous
      return origin === null
        ? state
        : writeShots(state, shots => shots.map(shot => (shot.id === shotId ? origin : shot)))
    },
  }
}

/** What a rail takes when it is first bound: the whole of it, forwards, at a steady speed. */
const WHOLE_RAIL: Omit<CameraMotion, 'pathId'> = { from: 0, to: 1, easing: 'linear' }

/**
 * A rail laid where a camera stands, aimed down its line of sight, and bound to its shot.
 *
 * One command for the two edits, so a single ⌘Z takes back the whole gesture rather than leaving
 * a rail nothing runs on.
 */
export function railForShot(camera: CameraNode, shot: CameraShot): Command<SceneState> {
  const rail = { ...pathNode(), transform: camera.transform }

  return multi(`shot:rail:${shot.id}`, [
    addNode(rail),
    editCameraShot(shot.id, { motion: { ...WHOLE_RAIL, pathId: rail.id } }),
  ])
}

/** Another rail on a shot that already exists, or none at all. */
export function bindRailToShot(shot: CameraShot, pathId: string): Command<SceneState> {
  const motion: CameraMotion | undefined =
    pathId === '' ? undefined : { ...WHOLE_RAIL, ...shot.motion, pathId }

  return editCameraShot(shot.id, { motion })
}

/** How long the whole thing runs, and how finely it is cut. */
export function setTimelineSettings(
  settings: Partial<{ duration: Us; fps: number }>,
): Command<SceneState> {
  let previous: { duration: Us; fps: number } | null = null

  return {
    id: 'timeline:settings',
    apply: state => {
      previous = { duration: state.animation.duration, fps: state.animation.fps }
      return { ...state, animation: { ...state.animation, ...settings } }
    },
    revert: state => {
      const origin = previous
      return origin === null ? state : { ...state, animation: { ...state.animation, ...origin } }
    },
  }
}

/**
 * The channels a drag records on, once auto-key is recording.
 *
 * Additive tracks make the flag necessary rather than nice: with nothing recording, a drag writes
 * the node's REST pose and every track then adds itself on top again, so the object springs back
 * the moment the pointer is released. Recording, the drag becomes a key instead — the difference
 * between where the object was put and where it rests.
 *
 * A bone is reached the same way. It was excluded here until the pose mode gave a way to select
 * one, which left bone channels evaluable and impossible to fill.
 */
export function recordingTracksFor(
  state: SceneState,
  nodeId: string,
  bone?: string,
): AnimationTrack[] {
  return state.animation.tracks.filter(
    track => !track.locked && track.target.nodeId === nodeId && track.target.bone === bone,
  )
}

export function recordMove(
  rest: Transform,
  pose: Transform,
  time: Us,
  tracks: readonly AnimationTrack[],
): Command<SceneState>[] {
  return tracks.flatMap(track =>
    // A lens is not a pose: a drag says nothing about a field of view, and `deltaOf` would hand
    // this channel the rotation delta of the very same gesture.
    track.target.property === 'fov'
      ? []
      : setAnimationKey(track.id, time, deltaOf(rest, pose, track.target.property)),
  )
}

/**
 * What one gizmo drag becomes, over a whole selection: keys where auto-key is recording and a
 * channel exists, an ordinary move everywhere else.
 *
 * One command whatever the mix, so a drag over a keyed cube and a plain sphere is one undo.
 * `null` when there is nothing to write at all.
 */
export function movesToCommand(
  state: SceneState,
  moves: readonly NodeMove[],
  at: Us,
  recording: boolean,
): Command<SceneState> | null {
  const keys: Command<SceneState>[] = []
  const plain: NodeMove[] = []

  for (const move of moves) {
    // An object that is ALREADY keyed records whatever the switch says.
    //
    // What the viewport shows is the rest pose PLUS what the keys add, so moving a keyed object
    // without recording writes the rest pose — and the object lands short of where it was
    // dropped, by exactly the value of the key standing at that instant. Nobody drags an object
    // meaning that. The switch decides whether an UNKEYED object starts being animated; once it
    // is, a drag is an edit of the animation.
    const held = recordingTracksFor(state, move.id, move.bone)
    const keyed = held.some(track => track.keys.length > 0)
    const tracks = recording || keyed ? held : []
    const rest = move.rest ?? nodeById(state, move.id)?.transform

    if (tracks.length === 0 || !rest) {
      // A bone has nowhere else to go: it is not a node, so there is no plain move to fall back
      // on — an unrecorded bone drag is simply dropped, and the renderer puts it back.
      if (!move.bone) plain.push(move)
      continue
    }
    keys.push(...recordMove(rest, move.transform, at, tracks))
  }

  if (plain.length > 0) keys.push(moveNodes(plain))
  if (keys.length === 0) return null
  return keys.length === 1 && keys[0] ? keys[0] : multi('transform', keys)
}
