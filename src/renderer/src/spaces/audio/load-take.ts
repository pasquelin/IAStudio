import type { Asset } from '@shared/domain/asset'
import { EMPTY_AUDIO_EDIT } from '@/engines/audio/edits'
import { audioEditsOf, useAudioEdits } from '@/stores/audio-edits'
import { addTakeToSequence, removeClipFromSequence } from '@/stores/sequences'

/**
 * Puts a take into the audio editor, and onto the montage under it.
 *
 * Shared by the drop on the waveform and by "open in the audio editor" in the shelf menu, so
 * the two cannot come to disagree about what loading a take means.
 *
 * Everything goes, chain and history: an edit is a length and a region measured against the take
 * it was made on. Carried over to another take they describe nothing, and "apply" would write
 * that nothing over the file.
 *
 * The montage half is not decoration. A take loaded into an editor over four empty tracks looks
 * exactly like a load that did nothing, and the only way to get sound onto the strip used to be
 * a drag from the shelf that nothing on screen announced.
 */
export function loadTake(documentId: string, asset: Asset): void {
  if (asset.type !== 'audio') return

  const store = useAudioEdits.getState()
  const current = audioEditsOf(store, documentId)
  if (current.assetId === asset.id) return

  // The old take's clip goes with the old take's chain. Left behind, loading a second take
  // would stack up clips nobody laid down, and the id below would name one of the strays.
  if (current.takeClipId) removeClipFromSequence(documentId, current.takeClipId)

  store.drop(documentId)
  store.replace(documentId, {
    ...EMPTY_AUDIO_EDIT,
    assetId: asset.id,
    takeClipId: addTakeToSequence(documentId, asset),
  })
}
