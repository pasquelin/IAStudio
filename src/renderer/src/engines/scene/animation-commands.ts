import type { AnimationTrack, Keyframe, TrackTarget } from '@shared/domain/animation'
import type { Transform, Vector3 } from '@shared/domain/scene'
import type { Us } from '@shared/domain/time'
import type { Command } from '../core/history'
import { moveNodes, multi } from './commands'
import { deltaOf, valueAt, withKey, withoutKey } from './animation-eval'
import { nodeById, type NodeMove, type SceneState } from './scene-state'

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
  let previous: readonly Keyframe[] | null = null

  return {
    id: `key:set:${trackId}`,
    apply: state => {
      const track = trackById(state, trackId)
      if (!track || track.locked) return state

      previous = track.keys
      return editTrack(state, trackId, current => ({
        ...current,
        keys: withKey(current.keys, { time, value }),
      }))
    },
    revert: state => {
      const origin = previous
      return origin === null
        ? state
        : editTrack(state, trackId, track => ({ ...track, keys: origin }))
    },
  }
}

export function removeAnimationKey(trackId: string, time: number): Command<SceneState> {
  let previous: readonly Keyframe[] | null = null

  return {
    id: `key:remove:${trackId}`,
    apply: state => {
      const track = trackById(state, trackId)
      if (!track || track.locked) return state

      previous = track.keys
      return editTrack(state, trackId, current => ({
        ...current,
        keys: withoutKey(current.keys, time),
      }))
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

  for (const trackId of trackIds) {
    const track = trackById(state, trackId)
    if (!track || track.locked) continue

    // What the track ALREADY stands at, which is what the viewport is showing. Between two keys
    // that is the interpolated value, so keying there pins the pose instead of snapping it to a
    // neutral — and a neutral is exactly what made the old button appear to do nothing.
    writes.push(setAnimationKey(trackId, time, valueAt(track, time)))
  }

  if (writes.length === 0) return null
  return writes.length === 1 && writes[0] ? writes[0] : multi('key:subject', writes)
}

/**
 * Slides a key along its track, keeping its value.
 *
 * A key landing on an instant another already holds REPLACES it, which is what `withKey` does
 * everywhere else — two keys on one frame is a state no evaluation can read twice.
 */
export function moveAnimationKey(trackId: string, from: Us, to: Us): Command<SceneState> {
  let previous: readonly Keyframe[] | null = null

  return {
    id: `key:move:${trackId}`,
    apply: state => {
      const track = trackById(state, trackId)
      if (!track || track.locked) return state

      const moving = track.keys.find(key => key.time === from)
      if (!moving) return state

      previous = track.keys
      return editTrack(state, trackId, current => ({
        ...current,
        keys: withKey(withoutKey(current.keys, from), { time: to, value: moving.value }),
      }))
    },
    revert: state => {
      const origin = previous
      return origin === null
        ? state
        : editTrack(state, trackId, track => ({ ...track, keys: origin }))
    },
  }
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
  return tracks.map(track =>
    setAnimationKey(track.id, time, deltaOf(rest, pose, track.target.property)),
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
    const tracks = recording ? recordingTracksFor(state, move.id) : []
    const rest = nodeById(state, move.id)?.transform
    if (tracks.length === 0 || !rest) {
      plain.push(move)
      continue
    }
    keys.push(...recordMove(rest, move.transform, at, tracks))
  }

  if (plain.length > 0) keys.push(moveNodes(plain))
  if (keys.length === 0) return null
  return keys.length === 1 && keys[0] ? keys[0] : multi('transform', keys)
}
