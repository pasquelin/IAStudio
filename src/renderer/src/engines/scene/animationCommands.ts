import {
  DIRECT_PROPERTIES,
  POSE_PROPERTIES,
  SCENE_SUBJECT_ID,
  type AnimationTimeline,
  type AnimationTrack,
  type CameraMotion,
  type CameraShot,
  type Keyframe,
  type TrackProperty,
  type TrackTarget,
} from '@shared/domain/animation'
import type { Transform, Vector3 } from '@shared/domain/scene'
import type { Us } from '@shared/domain/time'
import { commandId, type Command } from '../core/history'
import { addNode, moveNodes, multi, setCamera, setCameraOn } from './commands'
import type { FieldValue } from './propertyFields'
import { pathNode } from './nodeFactory'
import {
  anySoloed,
  deltaOf,
  fovAt,
  playsThrough,
  valueAt,
  withKey,
  withoutKey,
} from './animationEval'
import { shotsWith } from './cameraShots'
import {
  nodeById,
  type CameraNode,
  type NodeMove,
  type SceneNode,
  type SceneState,
} from './sceneState'

/**
 * Edits of the timeline, on the pattern of the sequence's own track commands: what a command
 * needs to revert is captured as it is APPLIED, never as it is built.
 *
 * They are separate from `commands.ts` because they touch one field of the state and none of the
 * nodes — and because a timeline edit that reached into a node would be the thing this whole
 * additive design exists to avoid.
 */

/**
 * The sheet is deliberately LEFT ALONE here: a revert would have had to put it back too, in every
 * command that writes a track. `animationRows` gives a line to whoever holds one instead.
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
  // The scene's composition has no pose and no lens: its channels are opened one parameter at a
  // time from the composition panel, so the band's diamond must open none of its own.
  if (subject.nodeId === SCENE_SUBJECT_ID) return []

  const camera = !subject.bone && nodeById(state, subject.nodeId)?.type === 'camera'
  return camera ? DIRECT_PROPERTIES : POSE_PROPERTIES
}

/**
 * Keys an object that may hold no channel yet, creating the ones it lacks — demanding a "track"
 * first would ask for the thing already standing in the viewport. Ids are minted here rather than
 * inside `apply`: a redo must name the same channels the undo took away.
 */
export function keyNode(
  state: SceneState,
  subject: { nodeId: string; bone?: string },
  time: Us,
  names: Readonly<Record<TrackProperty, string>>,
  mintId: (property: TrackProperty) => string,
  /** One channel rather than the whole pose. The band's diamond names none; a client may. */
  only?: TrackProperty,
): Command<SceneState> | null {
  const held = recordingTracksFor(state.animation, subject.nodeId, subject.bone)
  const missing = keyableProperties(state, subject)
    .filter(property => only === undefined || property === only)
    .filter(property => !held.some(track => track.target.property === property))

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
  const ids = recordingTracksFor(opening.animation, subject.nodeId, subject.bone)
    .filter(track => only === undefined || track.target.property === only)
    .map(track => track.id)

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

// Narrowed as it is gathered: a `filter` on the same predicate leaves `AnimationTrack | undefined`
// behind, and both callers then need a non-null assertion to read the track they just kept.
function unlockedTracks(
  state: SceneState,
  trackIds: readonly string[],
  keeps: (track: AnimationTrack) => boolean,
): AnimationTrack[] {
  return trackIds.flatMap(trackId => {
    const track = trackById(state, trackId)
    return track && !track.locked && keeps(track) ? [track] : []
  })
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
  const drops = unlockedTracks(state, trackIds, track =>
    track.keys.some(key => key.time === time),
  ).map(track => removeAnimationKey(track.id, time))

  if (drops.length === 0) return null
  return drops.length === 1 && drops[0] ? drops[0] : multi('key:unset', drops)
}

/**
 * Empties every channel of one subject, whatever instant its keys sit on.
 *
 * 🛑 There was no way to say « efface toutes les clés » in one call: `unkeySubject` takes one
 * instant, so a client asking for all of them sent the same call over and over — measured on the
 * bench pass of 2026-08-26, and it never cleared more than the key under the head.
 */
export function unkeySubjectWholly(
  state: SceneState,
  trackIds: readonly string[],
): Command<SceneState> | null {
  const drops = unlockedTracks(state, trackIds, track => track.keys.length > 0).map(track =>
    keysCommand(`key:clear:${track.id}`, track.id, () => []),
  )

  if (drops.length === 0) return null
  return drops.length === 1 && drops[0] ? drops[0] : multi('key:clear', drops)
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
    apply: state => writeShots(state, shots => shotsWith(shots, shot)),
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
      // Put back where it stood: two shots of one line starting together are settled by their
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
 * A shot moved, trimmed, aimed or set on a rail — one command for all of them, because each is
 * the same shot with other fields. Whichever fields are given are the ones written.
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

/**
 * One camera's line moved up or down the stack, which is what dragging its grip does.
 *
 * An edit of the DOCUMENT, unlike the sheet's own arrangement: this order is the law an overlap
 * is settled by, so moving a line changes what the film looks through.
 *
 * The whole list arrives written rather than a number of notches, and `coalesce` is why: a drag
 * merges into ONE entry that keeps the LAST apply, so a step would replay a three-notch gesture
 * as one. `cameraId` names the line only so two drags of two lines stay two entries.
 */
export function reorderCameraShots(
  cameraId: string,
  shots: readonly CameraShot[],
): Command<SceneState> {
  let previous: readonly CameraShot[] | null = null

  return {
    id: `shot:camera:${cameraId}`,
    apply: state => {
      previous = state.animation.shots
      return writeShots(state, () => shots)
    },
    revert: state => {
      const origin = previous
      return origin === null ? state : writeShots(state, () => origin)
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

/**
 * A rail on a camera the head covers no shot of: the shot is opened by the same gesture.
 *
 * A rail drives nothing without a shot to run it, so asking for one is asking for both — and
 * asking for both by hand meant finding a button in another panel first, with nothing saying so.
 */
export function railOnNewShot(camera: CameraNode, shot: CameraShot): Command<SceneState> {
  return multi(`shot:rail:new:${shot.id}`, [addCameraShot(shot), railForShot(camera, shot)])
}

/**
 * Another rail on a shot that already exists, or none at all. `changes` is what a caller who
 * knows the stretch it wants writes in the same breath — the panel names only the rail.
 */
export function bindRailToShot(
  shot: CameraShot,
  pathId: string,
  changes: Partial<Omit<CameraMotion, 'pathId'>> = {},
): Command<SceneState> {
  const motion: CameraMotion | undefined =
    pathId === '' ? undefined : { ...WHOLE_RAIL, ...shot.motion, ...changes, pathId }

  return editCameraShot(shot.id, { motion })
}

/**
 * Puts objects on the band, or takes them off it — the gesture that decides what is animated.
 *
 * `null` when it would change nothing, so a press on what is already there costs no undo. What
 * is taken off keeps its keys: a track still holds its line, by the rule in `animationRows`,
 * which is what stops a removal from hiding an animation.
 */
export function putOnAnimationSheet(
  state: SceneState,
  nodeIds: readonly string[],
): Command<SceneState> | null {
  // Sets on both sides: `includes` in a filter is quadratic, and putting a selection of a few
  // thousand on the band paid 61 ms for it, its undo as much again — measured 20/08.
  const held = new Set(state.animation.sheet)
  const added = [...new Set(nodeIds)].filter(id => !held.has(id))
  if (added.length === 0) return null

  const wanted = new Set(added)

  return {
    // Its LENGTH and its first, never the ids themselves: a whole selection joined made a 147 KiB
    // string, held for as long as the command sat in the undo stack, that nobody ever reads.
    id: `sheet:add:${added.length}:${added[0]}`,
    apply: current => writeSheet(current, [...current.animation.sheet, ...added]),
    revert: current =>
      writeSheet(
        current,
        current.animation.sheet.filter(id => !wanted.has(id)),
      ),
  }
}

/**
 * Takes objects off the band. Their keys stay — see `putOnAnimationSheet`.
 *
 * The whole selection in ONE command, never one per object: six taken off in a single gesture
 * have to come back in a single undo.
 */
export function takeOffAnimationSheet(
  state: SceneState,
  nodeIds: readonly string[],
): Command<SceneState> | null {
  // Captured with their places, so a revert puts them back WHERE they stood: a sheet somebody
  // arranged is not one to reshuffle. Through a `Set`, for the reason `putOnAnimationSheet` gives.
  const wanted = new Set(nodeIds)
  const taken = state.animation.sheet.flatMap((id, at) => (wanted.has(id) ? { id, at } : []))
  if (taken.length === 0) return null

  return {
    id: `sheet:remove:${taken.length}:${taken[0]?.id}`,
    apply: current =>
      writeSheet(
        current,
        current.animation.sheet.filter(id => !wanted.has(id)),
      ),
    revert: current => {
      const back = [...current.animation.sheet]
      // Ascending, so each insertion lands on a list that already holds everything before it.
      for (const one of taken) back.splice(one.at, 0, one.id)
      return writeSheet(current, back)
    },
  }
}

const writeSheet = (state: SceneState, sheet: readonly string[]): SceneState => ({
  ...state,
  animation: { ...state.animation, sheet },
})

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
  timeline: AnimationTimeline,
  nodeId: string,
  bone?: string,
): AnimationTrack[] {
  return timeline.tracks.filter(
    track => !track.locked && track.target.nodeId === nodeId && track.target.bone === bone,
  )
}

/**
 * Whether a gesture writes KEYS rather than the thing underneath.
 *
 * A subject ALREADY keyed records whatever the switch says: what a viewport shows is the rest
 * plus what the keys add, so writing underneath would move it by the value standing at that
 * instant. The switch only decides whether an UNKEYED subject starts being animated.
 */
function recordsKeys(tracks: readonly AnimationTrack[], recording: boolean): boolean {
  return tracks.length > 0 && (recording || tracks.some(track => track.keys.length > 0))
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
    const held = recordingTracksFor(state.animation, move.id, move.bone)
    const tracks = recordsKeys(held, recording) ? held : []
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

/**
 * What a lens field typed into the inspector becomes: a key on the camera's `fov` channel where
 * one records, the descriptor itself everywhere else.
 *
 * Which fields can be keyed is a property of `TrackProperty`, asked here rather than by the
 * panel: `fov` is the only one today, and the day a second joins the union no view has to learn
 * about it. The number handed in is what the lens must READ at that instant.
 */
export function lensToCommand(
  timeline: AnimationTimeline,
  nodes: readonly SceneNode[],
  name: string,
  value: FieldValue,
  at: Us,
  recording: boolean,
): Command<SceneState> {
  if (name !== 'fov' || typeof value !== 'number') return setCameraOn(nodes, name, value)
  const soloed = anySoloed(timeline)

  // Composed rather than batched: which of the two an angle becomes depends on the channel under
  // it, and only one of them writes onto the node — see `batch`.
  return multi(
    commandId(
      'lens',
      nodes.map(node => node.id),
    ),
    nodes.flatMap(node => {
      if (node.type !== 'camera') return []

      // What the channels PLAY at that instant, which is what the field was showing. The same
      // filter has to pick what gets written: a key laid on a muted channel is a number typed and
      // lost, and a descriptor written under a locked one moves the lens twice.
      const played = fovAt(timeline, node.id, at) ?? 0
      const lenses = recordingTracksFor(timeline, node.id).filter(
        track => track.target.property === 'fov' && playsThrough(track, soloed),
      )
      const lens = lenses[0]
      if (!lens || !recordsKeys(lenses, recording)) {
        return setCamera(node.id, { ...node.camera, fov: value - played })
      }

      // This channel's own share taken back out: whatever else plays goes on adding what it adds,
      // so the key holds exactly what is left for the lens to READ the number typed.
      return setAnimationKey(lens.id, at, {
        x: value - node.camera.fov - (played - valueAt(lens, at).x),
        y: 0,
        z: 0,
      })
    }),
  )
}
