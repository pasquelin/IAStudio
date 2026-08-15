import type { Asset } from '@shared/domain/asset'
import { useSelection } from '@/stores/selection'
import { addTakeToSequence } from '@/stores/sequences'

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

  const clipId = addTakeToSequence(documentId, asset)
  // The montage's own selection comes with `addClips`; this is the studio-wide one the inspector
  // reads, and a block in the editor that the inspector describes as nothing is half a selection.
  if (clipId) useSelection.getState().selectClip(documentId, clipId)
}
