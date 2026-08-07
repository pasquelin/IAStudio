import type { Command } from '../core/history'
import {
  clampFades,
  clampGain,
  clampSpeed,
  clipById,
  clipEnd,
  clipFrom,
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
 * How far a trim may travel before it would run past the media behind it. There is nothing to
 * show before a source starts or after it ends, and a clip stretched there freezes on a frame
 * while its sound goes silent.
 *
 * A media with no length of its own — a still — takes no bound: stretching one over a minute is
 * how a title card is made.
 */
export function boundToMedia(clip: Clip, edge: ClipEdge, at: Us, length: Us | null): Us {
  const headroom = (source: Us): Us => Math.round(source / clip.speed)

  if (edge === 'in') return Math.max(at, clip.start - headroom(clip.inPoint))
  return length === null ? at : Math.min(at, clip.start + headroom(length - clip.inPoint))
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

/**
 * Drags one edge of a clip. `mediaLength` is how long the source runs, or null for a still —
 * the command reads the sequence, and the catalogue is not part of it.
 *
 * A trim grows over its neighbour rather than stopping at it, the way DaVinci and Premiere do it
 * on their default tool: an editor lengthening a shot means the shot after it to give way.
 */
export function trimClip(
  clipId: string,
  edge: ClipEdge,
  at: Us,
  mediaLength: Us | null,
): Command<SequenceState> {
  let before: { clips: Clip[]; trackId: string } | null = null
  // Minted once with the command: a trim landing mid-neighbour cuts a tail loose, and a redo
  // must not rename it.
  const tailId = newClipId()

  return {
    id: `trim:${clipId}:${edge}`,
    apply: state => {
      const track = trackOfClip(state, clipId)
      const clip = clipById(state, clipId)
      if (!track || track.locked || !clip) return state

      const time = boundToMedia(clip, edge, snapToFrame(at, state.settings), mediaLength)
      const trimmed =
        edge === 'out' ? { ...clip, duration: time - clip.start } : clipFrom(clip, time)

      // Refused rather than clamped: a zero-length clip is not a shorter clip, it is a bug.
      if (trimmed.duration <= 0) return state

      before = { clips: track.clips, trackId: track.id }
      // Through the insertion, which is what keeps the track sorted and free of overlap when a
      // grown clip covers the one next to it — trimmed, split or dropped, as a drop would.
      return updateTrack(state, track.id, current =>
        insertClip(withoutClip(current, clipId), clampFades(trimmed), tailId),
      )
    },
    revert: state => {
      if (!before) return state
      return restore(state, before.trackId, before.clips)
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
      const tail: Clip = clampFades({ ...clipFrom(clip, time), id: tailId, fadeIn: 0 })

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
