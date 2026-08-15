import type { Asset } from '@shared/domain/asset'
import type { TakeShape } from '@/engines/audio/edits'
import { addClips, removeClip } from '@/engines/timeline/commands'
import { placementsForAsset, trackForAsset } from '@/engines/timeline/insert'
import {
  clampFades,
  clipById,
  EMPTY_SEQUENCE,
  updateClip,
  updateTrack,
  wholeFrames,
  type SequenceState,
  type Track,
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
 * Outside any gesture, unlike its neighbour: this hangs off a double-click or a drop, never off
 * a cursor being held, and merged into one it would take an undo entry away from whoever holds
 * that cursor.
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

  current.runOutsideGesture(documentId, addClips(placements))
  return laid.clip.id
}

/** Takes a clip back off a montage, outside any gesture and for the same reason. */
export function removeClipFromSequence(documentId: string, clipId: string): void {
  store.use.getState().runOutsideGesture(documentId, removeClip(clipId))
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
    duration: wholeFrames(shape.duration, sequence.settings),
    fadeIn: shape.fadeIn,
    fadeOut: shape.fadeOut,
    gain: shape.gain,
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
