import type { Asset } from '@shared/domain/asset'
import { clipById } from '@/engines/timeline/timelineState'
import { addTakeToSequence, sequenceOf, useSequences } from '@/stores/sequences'

/**
 * Puts a take on the montage — which is all it takes to open it in the editor below, the editor
 * showing whichever block is selected and `addClips` selecting what it lays down.
 *
 * Shared by the drop on the waveform and by "open in the audio editor" in the shelf menu, so the
 * two cannot come to disagree about what loading a take means.
 *
 * Nothing is dropped on the way in, where this used to clear the chain and take the previous
 * take's block off the strip: blocks accumulate on a montage, and each carries its own chain.
 * Loading a second take is now what it looks like — a second block, selected.
 */
export function loadTake(documentId: string, asset: Asset): void {
  if (asset.type !== 'audio') return

  // Already under the editor: nothing to do, and it is not a nicety. Asking a second time would
  // lay a NEW block over the one that holds these bytes — same take, new id — and the chain
  // that named the old id would be orphaned with every setting in it, unreachable and unsaid.
  const montage = sequenceOf(useSequences.getState(), documentId)
  const shown = montage.selectedId ? clipById(montage, montage.selectedId) : null
  if (shown?.assetId === asset.id) return

  addTakeToSequence(documentId, asset)
}
