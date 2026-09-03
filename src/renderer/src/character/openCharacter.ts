import { openDocument } from '@/features/shell/components/dockviewApi'
import { reportFailure } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { documentForAsset, useDocuments } from '@/stores/documents'

/**
 * Opens a model on a tab of its own, where it is given a skeleton and taught to move.
 *
 * A second call comes back to that tab rather than opening another: two tabs on one model are
 * two skeletons of it, and the second ⌘S would write over the first.
 */
export async function openCharacter(assetId: string): Promise<boolean> {
  const already = documentForAsset(useDocuments.getState(), assetId, 'character')
  if (already) {
    openDocument(already)
    return true
  }

  // The catalogue's name, and the id where it has not answered yet: a tab titled with a uuid is
  // one nobody can tell from another.
  const asset = assetsById(useAssets.getState()).get(assetId)
  const name = asset?.name ?? assetId
  const created = await useDocuments.getState().create('3d', {
    title: name,
    sourceAssetId: assetId,
    kind: 'character',
    // The model's own file: this tab has none in the project, and the Explorer joins a document
    // to a row by its path — composed instead, it would name a file nothing holds.
    ...(asset?.path ? { path: asset.path } : {}),
  })

  if (!created) {
    reportFailure('assets.open', name, new Error('no document'))
    return false
  }

  openDocument(created)
  return true
}
