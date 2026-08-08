import type { Asset } from '@shared/domain/asset'
import { EMPTY_AUDIO_EDIT } from '@/engines/audio/edits'
import { audioEditsOf, useAudioEdits } from '@/stores/audio-edits'

/**
 * Puts a take into the audio editor.
 *
 * Shared by the drop on the waveform and by "open in the audio editor" in the shelf menu, so
 * the two cannot come to disagree about what loading a take means.
 *
 * Everything goes, chain and history: an edit is a length and a region measured against the take
 * it was made on. Carried over to another take they describe nothing, and "apply" would write
 * that nothing over the file.
 */
export function loadTake(documentId: string, asset: Asset): void {
  if (asset.type !== 'audio') return

  const store = useAudioEdits.getState()
  if (audioEditsOf(store, documentId).assetId === asset.id) return

  store.drop(documentId)
  store.replace(documentId, { ...EMPTY_AUDIO_EDIT, assetId: asset.id })
}
