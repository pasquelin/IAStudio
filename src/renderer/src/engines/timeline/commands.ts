import type { Command } from '../core/history'
import {
  clipById,
  clipEnd,
  insertClip,
  snapToFrame,
  trackById,
  trackOfClip,
  type Clip,
  type SequenceState,
  type Track,
  type Us,
} from './timeline-state'

/**
 * Sequence edits, on the pattern of `engines/scene/commands.ts`: a command captures what it
 * needs to revert **as it is applied**, not as it is built — what a track looked like before is
 * only known once the edit runs. Redo re-applies and re-captures.
 */

const mapTrack = (
  state: SequenceState,
  trackId: string,
  change: (track: Track) => Track,
): SequenceState => ({
  ...state,
  tracks: state.tracks.map(track => (track.id === trackId ? change(track) : track)),
})

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
        ...mapTrack(state, trackId, current => insertClip(current, clip)),
        selectedId: clip.id,
      }
    },
    revert: state => ({
      ...mapTrack(state, trackId, current => withoutClip(current, clip.id)),
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
      const lifted = mapTrack(state, source.id, current => withoutClip(current, clipId))
      return {
        ...mapTrack(lifted, toTrackId, current => insertClip(current, moved)),
        selectedId: clipId,
      }
    },
    revert: state => {
      if (!from) return state
      const origin = from
      const lifted = mapTrack(state, toTrackId, current => withoutClip(current, clipId))
      return {
        ...mapTrack(lifted, origin.trackId, current => insertClip(current, origin.clip)),
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
      const next =
        edge === 'out'
          ? { ...clip, duration: time - clip.start }
          : {
              ...clip,
              start: time,
              duration: clipEnd(clip) - time,
              inPoint: clip.inPoint + (time - clip.start),
            }

      // Refused rather than clamped: a zero-length clip is not a shorter clip, it is a bug.
      if (next.duration <= 0 || next.inPoint < 0) return state

      before = { clip, trackId: track.id }
      return mapTrack(state, track.id, current => ({
        ...current,
        clips: current.clips.map(candidate => (candidate.id === clipId ? next : candidate)),
      }))
    },
    revert: state => {
      if (!before) return state
      const origin = before
      return mapTrack(state, origin.trackId, current => ({
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

      const head: Clip = { ...clip, duration: time - clip.start }
      const tail: Clip = {
        ...clip,
        id: tailId,
        start: time,
        duration: clipEnd(clip) - time,
        inPoint: clip.inPoint + (time - clip.start),
      }

      return mapTrack(state, track.id, current => ({
        ...current,
        clips: current.clips.flatMap(candidate =>
          candidate.id === clipId ? [head, tail] : [candidate],
        ),
      }))
    },
    revert: state => {
      if (!before) return state
      const origin = before
      return mapTrack(state, origin.trackId, current => ({
        ...current,
        clips: current.clips
          .filter(candidate => candidate.id !== origin.tailId)
          .map(candidate => (candidate.id === origin.clip.id ? origin.clip : candidate)),
      }))
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
        ...mapTrack(state, track.id, current => withoutClip(current, clipId)),
        selectedId: state.selectedId === clipId ? null : state.selectedId,
      }
    },
    revert: state => {
      if (!removed) return state
      const origin = removed
      return {
        ...mapTrack(state, origin.trackId, current => {
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
