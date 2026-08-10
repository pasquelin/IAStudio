import {
  EMPTY_TIMELINE,
  neutralOf,
  type AnimationTrack,
  type Keyframe,
  type TrackProperty,
  type TrackTarget,
} from '@shared/domain/animation'
import type { Transform, Vector3 } from '@shared/domain/scene'
import type { Command } from '../core/history'
import { deltaOf, withKey, withoutKey } from './animation-eval'
import type { SceneState } from './scene-state'

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
): SceneState => {
  const timeline = state.animation ?? EMPTY_TIMELINE
  return { ...state, animation: { ...timeline, tracks: reindexed(change(timeline.tracks)) } }
}

/** Row order read back from position, so the array and the numbers cannot drift apart. */
const reindexed = (tracks: readonly AnimationTrack[]): AnimationTrack[] =>
  tracks.map((track, position) => ({ ...track, index: position }))

const editTrack = (
  state: SceneState,
  trackId: string,
  change: (track: AnimationTrack) => AnimationTrack,
): SceneState =>
  write(state, tracks => tracks.map(track => (track.id === trackId ? change(track) : track)))

const trackById = (state: SceneState, trackId: string): AnimationTrack | undefined =>
  state.animation?.tracks.find(track => track.id === trackId)

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
          armed: false,
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
      const tracks = state.animation?.tracks ?? []
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

export function moveAnimationTrack(trackId: string, by: number): Command<SceneState> {
  let from: number | null = null

  const reorder = (tracks: readonly AnimationTrack[], position: number, to: number) => {
    const track = tracks[position]
    if (!track) return [...tracks]

    const moved = tracks.filter((_, at) => at !== position)
    moved.splice(to, 0, track)
    return moved
  }

  return {
    id: `track:move:${trackId}`,
    apply: state => {
      const tracks = state.animation?.tracks ?? []
      const position = tracks.findIndex(track => track.id === trackId)
      const to = position + by
      if (position < 0 || to < 0 || to >= tracks.length) return state

      from = position
      return write(state, current => reorder(current, position, to))
    },
    revert: state => {
      const origin = from
      return origin === null ? state : write(state, tracks => reorder(tracks, origin + by, origin))
    },
  }
}

export function renameAnimationTrack(trackId: string, name: string): Command<SceneState> {
  let previous: string | null = null

  return {
    id: `track:rename:${trackId}`,
    apply: state => {
      previous = trackById(state, trackId)?.name ?? null
      return editTrack(state, trackId, track => ({ ...track, name }))
    },
    revert: state => {
      const origin = previous
      return origin === null
        ? state
        : editTrack(state, trackId, track => ({ ...track, name: origin }))
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

/** How long the whole thing runs, and how finely it is cut. */
export function setTimelineSettings(
  settings: Partial<{ duration: number; fps: number }>,
): Command<SceneState> {
  let previous: { duration: number; fps: number } | null = null

  return {
    id: 'timeline:settings',
    apply: state => {
      const timeline = state.animation ?? EMPTY_TIMELINE
      previous = { duration: timeline.duration, fps: timeline.fps }
      return { ...state, animation: { ...timeline, ...settings } }
    },
    revert: state =>
      previous === null
        ? state
        : { ...state, animation: { ...(state.animation ?? EMPTY_TIMELINE), ...previous } },
  }
}

/** What a key would hold to leave the object exactly where it is: the neutral of its property. */
export function neutralKey(property: TrackProperty): Vector3 {
  return neutralOf(property)
}

/**
 * What a gizmo drag means when tracks are armed.
 *
 * Additive tracks make this the crux: with nothing armed, a drag writes the node's REST pose and
 * every track then adds itself on top again, so the object springs back the moment the pointer is
 * released. With a track armed, the drag becomes a key on it — the difference between where the
 * object was put and where it rests.
 *
 * A node with no armed track keeps the old behaviour, which is what makes an untouched scene
 * behave exactly as it did before any of this existed.
 */
export function armedTracksFor(state: SceneState, nodeId: string): AnimationTrack[] {
  return (state.animation?.tracks ?? []).filter(
    track => track.armed && !track.locked && track.target.nodeId === nodeId && !track.target.bone,
  )
}

export function recordMove(
  rest: Transform,
  pose: Transform,
  time: number,
  tracks: readonly AnimationTrack[],
): Command<SceneState>[] {
  return tracks.map(track =>
    setAnimationKey(track.id, time, deltaOf(rest, pose, track.target.property)),
  )
}
