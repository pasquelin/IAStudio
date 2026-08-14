import { composed, type Command } from '../core/history'
import type { ClipPlacement } from './insert'
import {
  clampFades,
  clampGain,
  clampSpeed,
  clipById,
  clipEnd,
  clipFrom,
  editableTrack,
  insertClip,
  linkedClipIds,
  makeTrack,
  newClipId,
  nextTrackId,
  reindexTracks,
  snapToFrame,
  trackById,
  trackOfClip,
  updateClip,
  updateTrack,
  type Clip,
  type ClipEdge,
  type SequenceState,
  type Track,
  type TrackKind,
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
 * The same edit, on a clip and on whatever a link ties to it — a take's picture and its sound.
 *
 * The twins are only known once there is a state to read, so the whole is composed on the first
 * apply and KEPT: a redo must replay the very same commands, each holding the id it minted for
 * a tail it cut loose, and rebuilding them would rename what undo had put back.
 */
function acrossLink(
  id: string,
  clipId: string,
  make: (state: SequenceState, linkedId: string) => Command<SequenceState> | null,
): Command<SequenceState> {
  let all: Command<SequenceState> | null = null

  return {
    id,
    apply: state => {
      all ??= composed(
        id,
        linkedClipIds(state, clipId).flatMap(linkedId => make(state, linkedId) ?? []),
      )
      return all.apply(state)
    },
    revert: state => all?.revert(state) ?? state,
  }
}

/**
 * What is known of the media behind a clip, which is not the same question as how long it runs.
 * `mediaDuration` answers null for a still AND for an asset nobody has probed yet — deliberately,
 * since both are timeless when a clip is first laid down. A trim has to tell them apart: a still
 * has no source to run past, an unprobed video has one whose length is simply not known yet.
 */
export type MediaExtent = Us | 'still' | 'unknown'

/**
 * How far a trim may travel before it would run past the media behind it. There is nothing to
 * show before a source starts or after it ends, and a clip stretched there freezes on a frame
 * while its sound goes silent.
 *
 * A still has nothing to run past on either edge, so both of its edges stretch it and the only
 * bound left is the start of the sequence. That is what makes a title card: put an image down,
 * pull either end, decide how long it stays up.
 */
function boundToMedia(clip: Clip, edge: ClipEdge, at: Us, media: MediaExtent): Us {
  const headroom = (source: Us): Us => Math.round(source / clip.speed)

  // The sequence start is the only bound a still has left, and `snapToFrame` already holds it.
  if (media === 'still') return edge === 'in' ? Math.max(at, 0) : at

  // An unknown length still bounds the in point: the source starts somewhere, whoever knows when.
  if (edge === 'in') return Math.max(at, clip.start - headroom(clip.inPoint))
  return media === 'unknown' ? at : Math.min(at, clip.start + headroom(media - clip.inPoint))
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

/**
 * Lays down what one asset became — one clip, or the picture and the sound of a take, which
 * must be ONE history entry: undoing a drop that put down two clips has to take back both.
 *
 * The picture is what ends up selected, whatever order the parts ran in: it is the half the
 * user aimed at, and the inspector reads the selection.
 */
export function addClips(placements: readonly ClipPlacement[]): Command<SequenceState> {
  const aimed = placements[0]?.clip.id ?? null
  const all = composed(
    `add:${aimed}`,
    placements.map(({ trackId, clip }) => addClip(trackId, clip)),
  )

  return { ...all, apply: state => ({ ...all.apply(state), selectedId: aimed }) }
}

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

/**
 * Drags a clip, and with it whatever is tied to it.
 *
 * A twin follows in time and stays on its own track: the sound of a take dragged from V1 to V2
 * has nowhere to go if the sequence holds one audio track, and a sound moved to a picture track
 * would be painted rather than heard.
 */
export function moveClip(clipId: string, toTrackId: string, start: Us): Command<SequenceState> {
  return acrossLink(`move:${clipId}`, clipId, (state, linkedId) => {
    if (linkedId === clipId) return moveOneClip(clipId, toTrackId, start)

    const twin = clipById(state, linkedId)
    const dragged = clipById(state, clipId)
    const track = trackOfClip(state, linkedId)
    if (!twin || !dragged || !track) return null

    return moveOneClip(linkedId, track.id, twin.start + (start - dragged.start))
  })
}

function moveOneClip(clipId: string, toTrackId: string, start: Us): Command<SequenceState> {
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
 * Drags one edge of a clip. `media` says what is known of the source behind it — see
 * `MediaExtent`; the command reads the sequence, and the catalogue is not part of it.
 *
 * A trim grows over its neighbour rather than stopping at it, the way DaVinci and Premiere do it
 * on their default tool: an editor lengthening a shot means the shot after it to give way.
 */
export function trimClip(
  clipId: string,
  edge: ClipEdge,
  at: Us,
  media: MediaExtent,
): Command<SequenceState> {
  // The same instant on both halves, and the same media behind them: a twin is the same asset,
  // so what bounds one bounds the other.
  return acrossLink(`trim:${clipId}:${edge}`, clipId, (_, linkedId) =>
    trimOneClip(linkedId, edge, at, media),
  )
}

function trimOneClip(
  clipId: string,
  edge: ClipEdge,
  at: Us,
  media: MediaExtent,
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

      const time = boundToMedia(clip, edge, snapToFrame(at, state.settings), media)
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
  // One link for both tails, minted once: the two halves of a cut take stay tied to each other
  // and to nothing else, or dragging one head would drag the far side of the cut with it.
  const tailLink = newClipId()
  return acrossLink(`split:${clipId}`, clipId, (_, linkedId) =>
    splitOneClip(linkedId, at, tailLink),
  )
}

function splitOneClip(clipId: string, at: Us, tailLink: string): Command<SequenceState> {
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
        ...clipFrom(clip, time),
        id: tailId,
        fadeIn: 0,
        // A link the head keeps, so the tail needs one of its own — shared with the tail of
        // whatever was cut alongside it.
        ...(clip.linkId ? { linkId: tailLink } : {}),
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

/**
 * Runs a clip faster or slower — and its twin with it, which is the whole point of the link.
 *
 * `speed` is read on both sides of the montage: `sourceTimeAt` seeks the picture with it and
 * `SoundCue.rate` resamples the sound with it. Changed on one half alone, the two drift apart
 * for good — the one failure a link exists to prevent. A fade and a gain, by contrast, are each
 * half's own business: a sound fades where a picture does not, and a picture has no level.
 */
export function setClipSpeed(clipId: string, speed: number): Command<SequenceState> {
  return acrossLink(`speed:${clipId}`, clipId, (_, linkedId) =>
    editClip(`speed:${linkedId}`, linkedId, clip => ({ ...clip, speed: clampSpeed(speed) })),
  )
}

/**
 * Unties a take's picture from its sound, so each half can be trimmed, moved or deleted alone.
 *
 * The whole group at once, not the clip it was asked on: a link with one member left is a clip
 * that still refuses nothing but looks tied, which is the worst of both.
 */
export function unlinkClip(clipId: string): Command<SequenceState> {
  let untied: { ids: string[]; linkId: string } | null = null

  const relink = (state: SequenceState, ids: readonly string[], linkId?: string): SequenceState =>
    ids.reduce(
      (current, id) =>
        updateClip(current, id, clip => {
          // Deleted off a copy rather than left as `undefined`: a clip written to disk with the
          // key still on it reads back as linked to nothing, and `linkedClipIds` would tie
          // together every clip a file was saved without one.
          const alone = { ...clip }
          delete alone.linkId
          return linkId ? { ...alone, linkId } : alone
        }),
      state,
    )

  return {
    id: `unlink:${clipId}`,
    apply: state => {
      const linkId = clipById(state, clipId)?.linkId
      if (!linkId) return state

      untied = { ids: linkedClipIds(state, clipId), linkId }
      return relink(state, untied.ids)
    },
    revert: state => (untied ? relink(state, untied.ids, untied.linkId) : state),
  }
}

/**
 * Adds a track at the bottom of the column. What it is called is decided as the command is
 * applied, not as it is built: two adds queued before either runs would otherwise pick the same
 * free name, and the second would land on a track that already exists.
 */
export function addTrack(kind: TrackKind): Command<SequenceState> {
  let added: string | null = null

  return {
    id: `track:add:${kind}`,
    apply: state => {
      const id = nextTrackId(state, kind)
      added = id
      return {
        ...state,
        tracks: reindexTracks([...state.tracks, makeTrack({ id, kind, index: 0 })]),
      }
    },
    revert: state =>
      added === null
        ? state
        : { ...state, tracks: reindexTracks(state.tracks.filter(track => track.id !== added)) },
  }
}

/**
 * Removes a track, clips and all. The whole track is captured rather than its id: undo has to
 * put back what it carried, and at the row it was on — a track restored at the bottom would
 * silently change what covers what.
 */
export function removeTrack(trackId: string): Command<SequenceState> {
  let before: { position: number; track: Track } | null = null

  return {
    id: `track:remove:${trackId}`,
    apply: state => {
      const position = state.tracks.findIndex(track => track.id === trackId)
      const track = state.tracks[position]
      if (!track || track.locked) return state

      before = { position, track }
      return {
        ...state,
        tracks: reindexTracks(state.tracks.filter(current => current.id !== trackId)),
        selectedId: track.clips.some(clip => clip.id === state.selectedId)
          ? null
          : state.selectedId,
      }
    },
    revert: state => {
      const origin = before
      if (!origin) return state

      const tracks = [...state.tracks]
      tracks.splice(origin.position, 0, origin.track)
      return { ...state, tracks: reindexTracks(tracks) }
    },
  }
}

/**
 * Moves a track one row up or down. `by` is a step rather than a target row so the two callers
 * that exist — the two menu entries — cannot disagree on what the rows are numbered from.
 */
export function moveTrack(trackId: string, by: number): Command<SequenceState> {
  let from: number | null = null

  const reorder = (tracks: readonly Track[], position: number, to: number): Track[] => {
    const track = tracks[position]
    if (!track) return [...tracks]

    const moved = tracks.filter((_, at) => at !== position)
    moved.splice(to, 0, track)
    return reindexTracks(moved)
  }

  return {
    id: `track:move:${trackId}`,
    apply: state => {
      const position = state.tracks.findIndex(track => track.id === trackId)
      const to = position + by
      if (position < 0 || to < 0 || to >= state.tracks.length) return state

      from = position
      return { ...state, tracks: reorder(state.tracks, position, to) }
    },
    revert: state =>
      from === null ? state : { ...state, tracks: reorder(state.tracks, from + by, from) },
  }
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

/**
 * Takes a clip away, and with it whatever is tied to it: a take whose picture is deleted and
 * whose sound stays behind is the state an editor never means to be in — unlink first, then
 * delete the half that is in the way.
 */
export function removeClip(clipId: string): Command<SequenceState> {
  return acrossLink(`remove:${clipId}`, clipId, (_, linkedId) => removeOneClip(linkedId))
}

function removeOneClip(clipId: string): Command<SequenceState> {
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
