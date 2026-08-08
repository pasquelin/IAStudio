import type { Asset } from '@shared/domain/asset'
import { addClip } from '@/engines/timeline/commands'
import { clipForAsset, trackForAsset } from '@/engines/timeline/insert'
import {
  EMPTY_SEQUENCE,
  updateTrack,
  type SequenceState,
  type Track,
} from '@/engines/timeline/timeline-state'
import { activeIdOfKind, useDocuments } from './documents'
import { createDocumentStore } from './document-store'

/** One sequence per document, in memory like the documents themselves. */
const store = createDocumentStore<SequenceState>(EMPTY_SEQUENCE)

export const sequenceStore = store
export const useSequences = store.use
export const sequenceOf = store.stateOf
export const historyOf = store.historyOf

/**
 * Drops an asset onto the montage in front, at the playhead. Nothing happens when the tab in
 * front is not a sequence, or when every track refuses it — silence rather than a throw, since
 * this hangs off a double-click that can land anywhere.
 */
export function addAssetToSequence(asset: Asset): void {
  const documentId = activeIdOfKind(useDocuments.getState(), 'sequence')
  if (!documentId) return

  const current = store.use.getState()
  const sequence = store.stateOf(current, documentId)
  const track = trackForAsset(sequence, asset)
  if (!track) return

  const clip = clipForAsset(asset.id, asset, sequence.playhead, sequence.settings)
  current.runCommand(documentId, addClip(track.id, clip))
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
