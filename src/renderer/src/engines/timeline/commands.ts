import type { Command } from '../core/history'
import {
  clampFades,
  clampGain,
  clampSpeed,
  clipById,
  clipEnd,
  editableTrack,
  insertClip,
  newClipId,
  snapToFrame,
  trackById,
  trackOfClip,
  updateClip,
  updateTrack,
  type Clip,
  type ClipEdge,
  type SequenceState,
  type Track,
  type Us,
} from './timeline-state'

/**
 * Sequence edits, on the pattern of `engines/scene/commands.ts`: a command captures what it
 * needs to revert **as it is applied**, not as it is built — what a track looked like before is
 * only known once the edit runs. Redo re-applies and re-captures.
 */

const withoutClip = (track: Track, clipId: string): Track => ({
  ...track,
  clips: track.clips.filter(clip => clip.id !== clipId),
})

/**
 * How far a trim may travel before it would run into the clip next door. The neighbour is
 * whichever clip sits immediately before or after on the same track; with none, the only
 * bound is the start of the sequence.
 */
function clampToNeighbour(track: Track, clip: Clip, edge: ClipEdge, at: Us): Us {
  const others = track.clips.filter(candidate => candidate.id !== clip.id)

  if (edge === 'out') {
    const after = others.filter(candidate => candidate.start >= clipEnd(clip))
    const ceiling = after.reduce<Us | null>(
      (nearest, candidate) =>
        nearest === null ? candidate.start : Math.min(nearest, candidate.start),
      null,
    )
    return ceiling === null ? at : Math.min(at, ceiling)
  }

  const before = others.filter(candidate => clipEnd(candidate) <= clip.start)
  const floor = before.reduce((nearest, candidate) => Math.max(nearest, clipEnd(candidate)), 0)
  return Math.max(at, floor)
}

/**
 * Puts a track's clips back exactly as they were.
 *
 * Insertion overwrites — it trims, splits and drops whatever the newcomer covers — so undoing
 * it by removing that one clip again leaves the neighbours it ate still eaten. Restoring the
 * whole list is the only way back to the state the user pressed undo from.
 */
const restore = (state: SequenceState, trackId: string, clips: Clip[]): SequenceState =>
  updateTrack(state, trackId, current => ({ ...current, clips }))

export function addClip(trackId: string, clip: Clip): Command<SequenceState> {
  let before: { clips: Clip[]; selectedId: string | null } | null = null
  const tailId = newClipId()

  return {
    id: `add:${clip.id}`,
    apply: state => {
      const track = editableTrack(state, trackId)
      if (!track) return state

      before = { clips: track.clips, selectedId: state.selectedId }
      return {
        ...updateTrack(state, trackId, current => insertClip(current, clip, tailId)),
        selectedId: clip.id,
      }
    },
    revert: state => {
      const origin = before
      if (!origin) return state
      return { ...restore(state, trackId, origin.clips), selectedId: origin.selectedId }
    },
  }
}

export function moveClip(clipId: string, toTrackId: string, start: Us): Command<SequenceState> {
  let from: {
    trackId: string
    sourceClips: Clip[]
    targetClips: Clip[]
    selectedId: string | null
  } | null = null
  const tailId = newClipId()

  return {
    id: `move:${clipId}`,
    apply: state => {
      const source = trackOfClip(state, clipId)
      const clip = clipById(state, clipId)
      const target = editableTrack(state, toTrackId)
      if (!source || source.locked || !clip || !target) return state

      from = {
        trackId: source.id,
        sourceClips: source.clips,
        targetClips: target.clips,
        selectedId: state.selectedId,
      }

      const moved: Clip = { ...clip, start: snapToFrame(start, state.settings) }
      const lifted = updateTrack(state, source.id, current => withoutClip(current, clipId))
      return {
        ...updateTrack(lifted, toTrackId, current => insertClip(current, moved, tailId)),
        selectedId: clipId,
      }
    },
    revert: state => {
      const origin = from
      if (!origin) return state

      // The target first: moving within one track makes both of these the same track, and the
      // source is the list that was there before anything moved.
      const restored = restore(state, toTrackId, origin.targetClips)
      return {
        ...restore(restored, origin.trackId, origin.sourceClips),
        selectedId: origin.selectedId,
      }
    },
  }
}

export function trimClip(clipId: string, edge: 'in' | 'out', at: Us): Command<SequenceState> {
  let before: { clip: Clip; trackId: string } | null = null

  return {
    id: `trim:${clipId}:${edge}`,
    apply: state => {
      const track = trackOfClip(state, clipId)
      const clip = clipById(state, clipId)
      if (!track || track.locked || !clip) return state

      // Bounded by the neighbour on the same track. A trim does not go through `insertClip`,
      // so nothing else would stop it from growing over the clip next to it — and two
      // overlapping clips are heard twice and painted on top of each other.
      const time = clampToNeighbour(track, clip, edge, snapToFrame(at, state.settings))
      const trimmed =
        edge === 'out'
          ? { ...clip, duration: time - clip.start }
          : {
              ...clip,
              start: time,
              duration: clipEnd(clip) - time,
              inPoint: clip.inPoint + (time - clip.start),
            }

      // Refused rather than clamped: a zero-length clip is not a shorter clip, it is a bug.
      if (trimmed.duration <= 0 || trimmed.inPoint < 0) return state

      // Trimming shorter than the ramps would leave fades hanging past the clip's own ends.
      const next = clampFades(trimmed)

      before = { clip, trackId: track.id }
      return updateTrack(state, track.id, current => ({
        ...current,
        clips: current.clips.map(candidate => (candidate.id === clipId ? next : candidate)),
      }))
    },
    revert: state => {
      if (!before) return state
      const origin = before
      return updateTrack(state, origin.trackId, current => ({
        ...current,
        clips: current.clips.map(candidate => (candidate.id === clipId ? origin.clip : candidate)),
      }))
    },
  }
}

export function splitClip(clipId: string, at: Us): Command<SequenceState> {
  let before: { clip: Clip; trackId: string } | null = null
  // Minted once with the command, not on each apply: a redo must not rename the tail.
  const tailId = newClipId()

  return {
    id: `split:${clipId}`,
    apply: state => {
      const track = trackOfClip(state, clipId)
      const clip = clipById(state, clipId)
      if (!track || track.locked || !clip) return state

      const time = snapToFrame(at, state.settings)
      if (time <= clip.start || time >= clipEnd(clip)) return state

      before = { clip, trackId: track.id }

      // The cut point gets no ramp: a split is a butt joint, and fading into it would dip the
      // level in the middle of what the ear still hears as one take.
      const head: Clip = clampFades({ ...clip, duration: time - clip.start, fadeOut: 0 })
      const tail: Clip = clampFades({
        ...clip,
        id: tailId,
        start: time,
        duration: clipEnd(clip) - time,
        inPoint: clip.inPoint + (time - clip.start),
        fadeIn: 0,
      })

      return updateTrack(state, track.id, current => ({
        ...current,
        clips: current.clips.flatMap(candidate =>
          candidate.id === clipId ? [head, tail] : [candidate],
        ),
      }))
    },
    revert: state => {
      if (!before) return state
      const origin = before
      return updateTrack(state, origin.trackId, current => ({
        ...current,
        clips: current.clips
          .filter(candidate => candidate.id !== tailId)
          .map(candidate => (candidate.id === origin.clip.id ? origin.clip : candidate)),
      }))
    },
  }
}

/**
 * One clip rewritten in place, reverted by putting back what was there. Every property edit —
 * fade, gain, speed — is this command with a different change, so none of them re-derives how
 * to find a clip, refuse a locked track or restore the original.
 */
function editClip(
  id: string,
  clipId: string,
  change: (clip: Clip) => Clip,
): Command<SequenceState> {
  let before: Clip | null = null

  return {
    id,
    apply: state => {
      const track = trackOfClip(state, clipId)
      const clip = clipById(state, clipId)
      if (!track || track.locked || !clip) return state

      before = clip
      return updateClip(state, clipId, change)
    },
    revert: state => {
      const origin = before
      return origin ? updateClip(state, clipId, () => origin) : state
    },
  }
}

export function setClipFade(clipId: string, edge: ClipEdge, length: Us): Command<SequenceState> {
  const ramp = Math.max(0, Math.round(length))
  return editClip(`fade:${clipId}:${edge}`, clipId, clip =>
    edge === 'in' ? { ...clip, fadeIn: ramp } : { ...clip, fadeOut: ramp },
  )
}

export function setClipGain(clipId: string, gain: number): Command<SequenceState> {
  return editClip(`gain:${clipId}`, clipId, clip => ({ ...clip, gain: clampGain(gain) }))
}

export function setClipSpeed(clipId: string, speed: number): Command<SequenceState> {
  return editClip(`speed:${clipId}`, clipId, clip => ({ ...clip, speed: clampSpeed(speed) }))
}

export function renameTrack(trackId: string, name: string): Command<SequenceState> {
  let before: string | null = null

  return {
    id: `rename:${trackId}`,
    apply: state => {
      const track = trackById(state, trackId)
      const trimmed = name.trim()
      // An empty name would leave the header blank with nothing to click back into.
      if (!track || !trimmed) return state

      before = track.name
      return updateTrack(state, trackId, current => ({ ...current, name: trimmed }))
    },
    revert: state => {
      const origin = before
      if (origin === null) return state
      return updateTrack(state, trackId, current => ({ ...current, name: origin }))
    },
  }
}

export function removeClip(clipId: string): Command<SequenceState> {
  let removed: { clip: Clip; trackId: string; index: number; selectedId: string | null } | null =
    null

  return {
    id: `remove:${clipId}`,
    apply: state => {
      const track = trackOfClip(state, clipId)
      if (!track || track.locked) return state

      const index = track.clips.findIndex(clip => clip.id === clipId)
      const clip = track.clips[index]
      if (!clip) return state

      removed = { clip, trackId: track.id, index, selectedId: state.selectedId }
      return {
        ...updateTrack(state, track.id, current => withoutClip(current, clipId)),
        selectedId: state.selectedId === clipId ? null : state.selectedId,
      }
    },
    revert: state => {
      if (!removed) return state
      const origin = removed
      return {
        ...updateTrack(state, origin.trackId, current => {
          const clips = [...current.clips]
          // Back at its original index: re-appending would reorder a track the eye reads by order.
          clips.splice(origin.index, 0, origin.clip)
          return { ...current, clips }
        }),
        selectedId: origin.selectedId,
      }
    },
  }
}
