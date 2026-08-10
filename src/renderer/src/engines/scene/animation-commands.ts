import type { AnimationTrack, Keyframe, TrackTarget } from '@shared/domain/animation'
import type { Transform, Vector3 } from '@shared/domain/scene'
import type { Command } from '../core/history'
import { moveNodes, multi } from './commands'
import { deltaOf, withKey, withoutKey } from './animation-eval'
import type { NodeMove, SceneState } from './scene-state'

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

/** How long the whole thing runs, and how finely it is cut. */
export function setTimelineSettings(
  settings: Partial<{ duration: number; fps: number }>,
): Command<SceneState> {
  let previous: { duration: number; fps: number } | null = null

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
  return state.animation.tracks.filter(
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

/**
 * What one gizmo drag becomes, over a whole selection: keys on the tracks that are armed, and an
 * ordinary move for every node that has none.
 *
 * One command whatever the mix, so a drag over an armed cube and a plain sphere is one undo.
 * `null` when there is nothing to write at all.
 */
export function movesToCommand(
  state: SceneState,
  moves: readonly NodeMove[],
  at: number,
): Command<SceneState> | null {
  const keys: Command<SceneState>[] = []
  const plain: NodeMove[] = []

  for (const move of moves) {
    const armed = armedTracksFor(state, move.id)
    const rest = state.nodes.find(node => node.id === move.id)?.transform
    if (armed.length === 0 || !rest) {
      plain.push(move)
      continue
    }
    keys.push(...recordMove(rest, move.transform, at, armed))
  }

  if (plain.length > 0) keys.push(moveNodes(plain))
  if (keys.length === 0) return null
  return keys.length === 1 && keys[0] ? keys[0] : multi('transform', keys)
}
