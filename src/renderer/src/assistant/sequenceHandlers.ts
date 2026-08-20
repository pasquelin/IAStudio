import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { Command } from '@/engines/core/history'
import {
  addClips,
  addClipsOnNewTracks,
  addTrack,
  mediaExtentOf,
  moveClip,
  moveTrack,
  removeClip,
  removeTrack,
  renameTrack,
  setClipFade,
  setClipGain,
  setClipSpeed,
  splitClip,
  trimClip,
  unlinkClip,
} from '@/engines/timeline/commands'
import { newTracksForAsset, placementsForAsset } from '@/engines/timeline/insert'
import {
  CLIP_EDGES,
  clampTrackHeight,
  clipById,
  clipEnd,
  editableTrack,
  sequenceDuration,
  TRACK_KINDS,
  trackById,
  type Clip,
  type SequenceState,
} from '@/engines/timeline/timelineState'
import { activeMontageId, useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences, writeTrack } from '@/stores/sequences'
import { withAsset, withBridge, type ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, textOf } from './actionInputs'

/**
 * Clips and tracks, driven by value.
 *
 * Every one of these runs a command of `engines/timeline/commands.ts` — the same ones the strip
 * runs, so an edit made from outside undoes exactly like one made with the mouse. The four dials
 * of `track.adjust` are the exception the header column already makes: they never enter the
 * history.
 */

/** The montage in front, in either workspace, or nothing — which reads as `wrongSurface`. */
function mounted(): { documentId: string; state: SequenceState } | null {
  const documentId = activeMontageId(useDocuments.getState())
  return documentId === null
    ? null
    : { documentId, state: sequenceOf(useSequences.getState(), documentId) }
}

function stateOf(documentId: string): SequenceState {
  return sequenceOf(useSequences.getState(), documentId)
}

function run(documentId: string, command: Command<SequenceState>): ActionOutcome {
  useSequences.getState().runCommand(documentId, command)
  return { ok: true }
}

/**
 * The same, for one named clip, found before anything runs.
 *
 * The lookup is the point: a command whose clip is gone answers by returning the state untouched,
 * so without it every miss would be reported as done.
 */
function editClipOf(
  input: Record<string, unknown>,
  build: (clip: Clip, state: SequenceState) => Command<SequenceState> | null,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const clip = clipById(open.state, textOf(input, 'clipId') ?? '')
  if (!clip) return refused('notFound')

  const command = build(clip, open.state)
  return command ? run(open.documentId, command) : refused('badInput')
}

/** The same for a track, and only one an edit may reach: a locked row refuses in silence. */
function editTrackOf(
  input: Record<string, unknown>,
  build: (trackId: string, state: SequenceState) => Command<SequenceState> | null,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const track = editableTrack(open.state, textOf(input, 'trackId') ?? '')
  const command = track && build(track.id, open.state)
  return command ? run(open.documentId, command) : refused('badInput')
}

const clipIdsOf = (state: SequenceState): string[] =>
  state.tracks.flatMap(track => track.clips.map(clip => clip.id))

function readState(): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  return {
    ok: true,
    data: {
      documentId: open.documentId,
      settings: open.state.settings,
      playhead: open.state.playhead,
      selectedId: open.state.selectedId,
      duration: sequenceDuration(open.state),
      tracks: open.state.tracks.map(track => ({
        id: track.id,
        kind: track.kind,
        name: track.name,
        index: track.index,
        muted: track.muted,
        solo: track.solo,
        locked: track.locked,
        clips: track.clips.map(clip => ({
          id: clip.id,
          assetId: clip.assetId,
          ...(clip.sceneId === undefined ? {} : { sceneId: clip.sceneId }),
          start: clip.start,
          duration: clip.duration,
          end: clipEnd(clip),
          inPoint: clip.inPoint,
          speed: clip.speed,
          fadeIn: clip.fadeIn,
          fadeOut: clip.fadeOut,
          gain: clip.gain,
          ...(clip.linkId === undefined ? {} : { linkId: clip.linkId }),
        })),
      })),
    },
  }
}

/**
 * Lays an asset down, opening the rows it needs when the montage has none — which is what a drop
 * on an empty timeline does.
 *
 * The clips are answered by comparing the montage before and after, and that is also what tells a
 * refusal from a placement: a rush over a sound montage opens no row and adds no clip, and
 * `addClipsOnNewTracks` says so by handing the state back untouched.
 */
function addClip(input: Record<string, unknown>): Promise<ActionOutcome> {
  const open = mounted()
  if (!open) return Promise.resolve(refused('wrongSurface'))

  const assetId = textOf(input, 'assetId') ?? ''
  return withAsset(assetId, asset => {
    const start = numberOf(input, 'start') ?? open.state.playhead
    const placements = placementsForAsset(
      open.state,
      asset,
      assetId,
      start,
      textOf(input, 'trackId') ?? undefined,
    )

    if (placements.length === 0 && newTracksForAsset(open.state, asset).length === 0) {
      return refused('badInput')
    }

    const before = new Set(clipIdsOf(open.state))
    run(
      open.documentId,
      placements.length > 0 ? addClips(placements) : addClipsOnNewTracks(asset, assetId, start),
    )

    const laid = clipIdsOf(stateOf(open.documentId)).filter(id => !before.has(id))
    return laid.length === 0 ? refused('badInput') : { ok: true, data: { clipIds: laid } }
  })
}

/** A trim stops where the media does, and only the catalogue knows how far that is. */
async function trim(input: Record<string, unknown>): Promise<ActionOutcome> {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const clip = clipById(open.state, textOf(input, 'clipId') ?? '')
  const edge = oneOf(input, 'edge', CLIP_EDGES)
  const at = numberOf(input, 'at')
  if (!clip || !edge || at === null) return refused('badInput')

  // A live scene clip carries no catalogue row at all, and `mediaExtentOf` answers `unknown` for
  // it — the same thing the strip reads under the pointer.
  const found = await withBridge(bridge =>
    clip.assetId === ''
      ? Promise.resolve([])
      : bridge.assets.search({ ids: [clip.assetId], limit: 1 }),
  )
  if (!found.ok) return found

  const asset = Array.isArray(found.data) ? (found.data[0] ?? null) : null
  return run(open.documentId, trimClip(clip.id, edge, at, mediaExtentOf(asset)))
}

function seek(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const time = numberOf(input, 'time')
  if (time === null) return refused('badInput')

  // Not a command: where the head sits is how one looks at a montage, not an edit of it — the
  // strip writes it through `replace` for the same reason.
  useSequences.getState().replace(open.documentId, {
    ...open.state,
    playhead: Math.min(time, sequenceDuration(open.state)),
  })
  return { ok: true }
}

function select(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const clip = clipById(open.state, textOf(input, 'clipId') ?? '')
  if (!clip) return refused('notFound')

  useSequences.getState().replace(open.documentId, { ...open.state, selectedId: clip.id })
  return { ok: true }
}

function adjustTrack(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const track = trackById(open.state, textOf(input, 'trackId') ?? '')
  if (!track) return refused('notFound')

  const height = numberOf(input, 'height')
  writeTrack(open.documentId, track.id, current => ({
    ...current,
    ...(input.muted === undefined ? {} : { muted: boolOf(input, 'muted') }),
    ...(input.solo === undefined ? {} : { solo: boolOf(input, 'solo') }),
    ...(input.locked === undefined ? {} : { locked: boolOf(input, 'locked') }),
    ...(height === null ? {} : { height: clampTrackHeight(height) }),
  }))
  return { ok: true }
}

export const SEQUENCE_HANDLERS: ActionHandlers = {
  'sequence.state': readState,
  'sequence.seek': seek,
  'clip.add': addClip,
  'clip.trim': trim,
  'clip.select': select,
  'track.adjust': adjustTrack,

  'clip.remove': input => editClipOf(input, clip => removeClip(clip.id)),
  'clip.unlink': input => editClipOf(input, clip => unlinkClip(clip.id)),

  'clip.move': input => {
    const start = numberOf(input, 'start')
    const trackId = textOf(input, 'trackId')
    return editClipOf(input, (clip, state) =>
      // A row that is gone, or locked, takes nothing: `moveClip` hands the state back.
      start === null || !trackId || !editableTrack(state, trackId)
        ? null
        : moveClip(clip.id, trackId, start),
    )
  },

  'clip.split': input => {
    const at = numberOf(input, 'at')
    return editClipOf(input, clip =>
      // Outside the clip there is nothing to cut, and the command says so by changing nothing.
      at === null || at <= clip.start || at >= clipEnd(clip) ? null : splitClip(clip.id, at),
    )
  },

  'clip.fade': input => {
    const edge = oneOf(input, 'edge', CLIP_EDGES)
    const length = numberOf(input, 'length')
    return editClipOf(input, clip =>
      edge && length !== null ? setClipFade(clip.id, edge, length) : null,
    )
  },

  'clip.gain': input => {
    const gain = numberOf(input, 'gain')
    return editClipOf(input, clip => (gain === null ? null : setClipGain(clip.id, gain)))
  },

  'clip.speed': input => {
    const speed = numberOf(input, 'speed')
    return editClipOf(input, clip => (speed === null ? null : setClipSpeed(clip.id, speed)))
  },

  'track.add': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const kind = oneOf(input, 'kind', TRACK_KINDS)
    return kind ? run(open.documentId, addTrack(kind)) : refused('badInput')
  },

  'track.remove': input => editTrackOf(input, trackId => removeTrack(trackId)),

  'track.move': input => {
    const by = numberOf(input, 'by')
    return editTrackOf(input, trackId => (by === null ? null : moveTrack(trackId, by)))
  },

  'track.rename': input => {
    const name = textOf(input, 'name')
    return editTrackOf(input, trackId => (name === null ? null : renameTrack(trackId, name)))
  },
}
