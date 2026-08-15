import type { Asset } from '@shared/domain/asset'
import type { TakeShape } from '@/engines/audio/edits'
import { addClips, removeClip } from '@/engines/timeline/commands'
import { placementsForAsset, trackForAsset } from '@/engines/timeline/insert'
import {
  clampFades,
  clampGain,
  clipById,
  EMPTY_SEQUENCE,
  trackOfClip,
  updateClip,
  updateTrack,
  wholeFrames,
  type Clip,
  type SequenceState,
  type Track,
  type Us,
} from '@/engines/timeline/timeline-state'
import { sameValues } from '@/helpers/objects'
import { createDocumentStore } from './document-store'

/** One sequence per document, in memory like the documents themselves. */
const store = createDocumentStore<SequenceState>(EMPTY_SEQUENCE)

export const sequenceStore = store
export const useSequences = store.use
export const sequenceOf = store.stateOf
export const sequenceHistoryOf = store.historyOf

/**
 * Whether any track of that montage would hold this asset — what keeps the cascade from
 * settling on a destination that then refuses in silence, and switches workspace to do it.
 */
export function sequenceTakes(documentId: string, asset: Asset): boolean {
  return trackForAsset(store.stateOf(store.use.getState(), documentId), asset) !== null
}

/**
 * Drops an asset onto a montage, at its playhead. Nothing happens when every track refuses it —
 * silence rather than a throw, since this hangs off a double-click that can land anywhere.
 *
 * The document is named by the caller, like every other destination of `ASSET_INTENTS`: reading
 * the tab in front here made this the one destination an asset could not be sent to from
 * somewhere else.
 */
export function addAssetToSequence(documentId: string, asset: Asset): void {
  const current = store.use.getState()
  // The guard its neighbour below carries, and for the same window: `stateOf` answers with the
  // SEQUENCE DEFAULT for a document whose file is still being read, so a drop landing there
  // writes a montage of that default — and the file, arriving after it, has a state to argue
  // with. Silence, like every other refusal of this function.
  if (!store.hasState(current, documentId)) return

  const sequence = store.stateOf(current, documentId)

  const placements = placementsForAsset(sequence, asset, asset.id, sequence.playhead)
  if (placements.length > 0) current.runCommand(documentId, addClips(placements))
}

/**
 * Lays a take down and answers WHICH clip it became — the one thing its neighbour above cannot
 * say, and the Audio workspace needs it: the take under the editor and the clip on the strip are
 * two views of one thing, and only an id ties them.
 *
 * Null when no track would take it, on the same reasoning: a montage whose sound tracks are all
 * locked has nowhere to put this, and refusing beats laying a clip where nothing plays it.
 *
 * Outside the HISTORY, not merely outside a gesture, and that is what its neighbour cannot do:
 * loading a take is not something ⌘Z gives back — the editor half drops its chain outright. Left
 * on the stack, one press right after a load undid the clip while the chain went on naming it,
 * and every later edit stopped reaching a strip that no longer held it.
 */
export function addTakeToSequence(documentId: string, asset: Asset): string | null {
  const current = store.use.getState()
  // Nothing rather than the wrong thing, as `SoundPanel` puts it: `stateOf` answers with the
  // SEQUENCE default — a picture track — for a document whose file is still on its way, and a
  // take dropped in that window would build the Audio workspace a row it cannot play.
  if (!store.hasState(current, documentId)) return null

  const sequence = store.stateOf(current, documentId)

  const placements = placementsForAsset(sequence, asset, asset.id, sequence.playhead)
  const laid = placements[0]
  if (!laid) return null

  current.replace(documentId, addClips(placements).apply(sequence))
  return laid.clip.id
}

/** Takes a clip back off a montage, outside the history and for the same reason. */
export function removeClipFromSequence(documentId: string, clipId: string): void {
  const current = store.use.getState()
  if (!store.hasState(current, documentId)) return

  current.replace(documentId, removeClip(clipId).apply(store.stateOf(current, documentId)))
}

/**
 * A length that stops where the next clip on the track begins.
 *
 * `updateClip` writes in place, with none of the overwrite insertion `insertClip` performs, and
 * a take growing back — a crop undone, a chain emptied by "apply" — would otherwise run over its
 * neighbour. Clips of a track are sorted and never overlap, and every later edit assumes it.
 */
function fits(state: SequenceState, clip: Clip, duration: Us): Us {
  const track = trackOfClip(state, clip.id)
  const next = track?.clips.find(other => other.start > clip.start)
  return next ? Math.min(duration, next.start - clip.start) : duration
}

/**
 * Rewrites the clip a take was laid down as, so that what the strip plays is what the editor
 * plays: bounds, ramps and level all come from the chain above it.
 *
 * Outside the history, like `writeTrack` below and for a stricter reason than convenience: the
 * chain already owns ⌘Z here, and a second entry per edit would make one press give back half a
 * change — the studio's "two diverging undo stacks", from the other end.
 *
 * `start` and `speed` are left alone: where a take sits on the strip and how fast it runs are
 * decisions about the montage, and the editor above knows nothing of either.
 */
export function writeTakeClip(documentId: string, clipId: string, shape: TakeShape): void {
  const current = store.use.getState()
  if (!store.hasState(current, documentId)) return

  const sequence = store.stateOf(current, documentId)
  const clip = clipById(sequence, clipId)
  if (!clip) return

  // Clamped HERE rather than left to `updateClip`, which clamps on the way in: comparing against
  // the unclamped shape would answer "changed" forever as soon as the two ramps outlast the
  // clip — the very case `replayEdits` documents as approximate — and every render would repaint
  // the strip. On the frame grid too, exactly as `clipForAsset` lays a clip down: a duration
  // that is not a whole number of frames leaves a tail nothing can snap to.
  const shaped = clampFades({
    ...clip,
    inPoint: shape.inPoint,
    // Source time divided by the speed, because a clip's duration is TIMELINE time — the two are
    // the same only at speed 1. `sourceTimeAt` multiplies by it going the other way.
    duration: fits(sequence, clip, wholeFrames(shape.duration / clip.speed, sequence.settings)),
    fadeIn: shape.fadeIn,
    fadeOut: shape.fadeOut,
    // Bounded like every other writer of this field. A quiet take normalised to −14 LUFS asks
    // for +26 dB, which `applyGain` absorbs on the samples it clamps and the strip does not:
    // `sound-schedule` would hand the output a twentyfold gain on the raw source.
    gain: clampGain(shape.gain),
  })
  // A render answers on every open of a document, not only on an edit, and writing an unchanged
  // clip would wake every reader of the montage for nothing.
  if (sameValues(clip, shaped)) return

  current.replace(
    documentId,
    updateClip(sequence, clipId, () => shaped),
  )
}

/**
 * Rewrites a track outside the history.
 *
 * Mute, solo, lock and height are how one works, not what one made: they have no business on
 * the undo stack. Written here rather than in each surface — the header column and the
 * inspector both do it, and the rule has to hold in one place.
 */
export function writeTrack(
  documentId: string,
  trackId: string,
  change: (track: Track) => Track,
): void {
  const current = store.use.getState()
  current.replace(documentId, updateTrack(store.stateOf(current, documentId), trackId, change))
}
