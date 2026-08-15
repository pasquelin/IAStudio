import type { Asset } from '@shared/domain/asset'
import { addClips, removeClip } from '@/engines/timeline/commands'
import { placementsForAsset, trackForAsset } from '@/engines/timeline/insert'
import {
  EMPTY_SEQUENCE,
  updateTrack,
  type SequenceState,
  type Track,
} from '@/engines/timeline/timeline-state'
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
