import type { Asset } from '@shared/domain/asset'
import { addClip } from '@/engines/timeline/commands'
import { clipForAsset, trackForAsset } from '@/engines/timeline/insert'
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
