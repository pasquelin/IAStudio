import type { Command } from '../core/history'
import {
  clampFades,
  clampGain,
  clampSpeed,
  clipById,
  clipEnd,
  insertClip,
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

/** A locked track refuses every edit, so every command starts by asking. */
const editable = (state: SequenceState, trackId: string): Track | null => {
  const track = trackById(state, trackId)
  return track && !track.locked ? track : null
}

export function addClip(trackId: string, clip: Clip): Command<SequenceState> {
  let selectedBefore: string | null = null

  return {
    id: `add:${clip.id}`,
    apply: state => {
      const track = editable(state, trackId)
      if (!track) return state

      selectedBefore = state.selectedId
      return {
        ...updateTrack(state, trackId, current => insertClip(current, clip)),
        selectedId: clip.id,
      }
    },
    revert: state => ({
      ...updateTrack(state, trackId, current => withoutClip(current, clip.id)),
      selectedId: selectedBefore,
    }),
  }
}

export function moveClip(clipId: string, toTrackId: string, start: Us): Command<SequenceState> {
  let from: { trackId: string; clip: Clip; selectedId: string | null } | null = null

  return {
    id: `move:${clipId}`,
    apply: state => {
      const source = trackOfClip(state, clipId)
      const clip = clipById(state, clipId)
      const target = editable(state, toTrackId)
      if (!source || source.locked || !clip || !target) return state

      from = { trackId: source.id, clip, selectedId: state.selectedId }
      const moved: Clip = { ...clip, start: snapToFrame(start, state.settings) }
      const lifted = updateTrack(state, source.id, current => withoutClip(current, clipId))
      return {
        ...updateTrack(lifted, toTrackId, current => insertClip(current, moved)),
        selectedId: clipId,
      }
    },
    revert: state => {
      if (!from) return state
      const origin = from
      const lifted = updateTrack(state, toTrackId, current => withoutClip(current, clipId))
      return {
        ...updateTrack(lifted, origin.trackId, current => insertClip(current, origin.clip)),
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

      const time = snapToFrame(at, state.settings)
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
  let before: { clip: Clip; trackId: string; tailId: string } | null = null

  return {
    id: `split:${clipId}`,
    apply: state => {
      const track = trackOfClip(state, clipId)
      const clip = clipById(state, clipId)
      if (!track || track.locked || !clip) return state

      const time = snapToFrame(at, state.settings)
      if (time <= clip.start || time >= clipEnd(clip)) return state

      const tailId = `${clip.id}-b`
      before = { clip, trackId: track.id, tailId }

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
          .filter(candidate => candidate.id !== origin.tailId)
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
