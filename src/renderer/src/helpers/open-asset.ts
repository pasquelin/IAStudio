import type { Asset } from '@shared/domain/asset'
import { EMPTY_AUDIO_EDIT } from '@/engines/audio/edits'
import { audioEditsOf, useAudioEdits } from '@/stores/audio-edits'
import { activeIdOfKind, useDocuments } from '@/stores/documents'
import { addAssetToSequence } from '@/stores/sequences'
import { setSkyboxSource } from '@/stores/skyboxes'

/**
 * What double-clicking an asset does, which depends on what is open rather than on what was
 * clicked: a take goes onto the montage when a sequence is in front, into the editor when an
 * audio tab is, and a picture becomes the sky when a skybox tab is. Nothing happens when none
 * is — the shelf is shown in every workspace, and some have nowhere to put an asset yet.
 */
export function openAsset(asset: Asset): void {
  const documents = useDocuments.getState()

  if (activeIdOfKind(documents, 'skybox')) {
    setSkyboxSource(asset)
    return
  }

  const audioTab = activeIdOfKind(documents, 'audio')
  if (audioTab && asset.type === 'audio') {
    const store = useAudioEdits.getState()
    if (audioEditsOf(store, audioTab).assetId === asset.id) return

    // Everything goes, chain and history: an edit is a length and a region measured against the
    // take it was made on. Carried over to another take they describe nothing, and "apply"
    // would write that nothing over the file.
    store.drop(audioTab)
    store.replace(audioTab, { ...EMPTY_AUDIO_EDIT, assetId: asset.id })
    return
  }

  addAssetToSequence(asset)
}
