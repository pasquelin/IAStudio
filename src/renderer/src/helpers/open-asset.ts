import type { Asset } from '@shared/domain/asset'
import { openDocument } from '@/app/dockview-api'
import { reportFailure } from '@/services/diagnostics'
import { documentForAsset, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { editorIntent } from './asset-intents'

/**
 * What opening an asset does — double-click or Enter: a tab of its own, in the space that edits
 * its kind. The context menu and the drag keep the destinations of `ASSET_INTENTS`, which serve
 * the document already open; this gesture serves the asset.
 *
 * It never reads the tab in front, deliberately. Doing so made one gesture mean two things —
 * a picture became a layer over an image tab and a sky over a skybox one — and neither was
 * "open this asset". A rule with no exception is the only one a hand can learn.
 *
 * A refusal is said out loud, as it has to be: the same double-click worked over one tab and did
 * nothing at all over another, without a word either way.
 */
export async function openAsset(asset: Asset): Promise<void> {
  const already = documentForAsset(useDocuments.getState(), asset.id)
  // Back to its own tab rather than a second one onto the same asset: two tabs of one document
  // are two histories of it, and the second save writes over the first.
  if (already) return openDocument(already)

  const intent = editorIntent(asset)
  // `takes` before anything is made: an editor that would refuse the asset — a picture the cloud
  // still holds — must say so rather than leave an empty tab standing where a refusal belonged.
  if (!intent?.takes(asset)) {
    return reportFailure('assets.open', asset.name, new Error('no destination'))
  }

  // A document is a file in a project folder, so without one there is nowhere to write it —
  // `create` alone would post a descriptor for a tab that can never be saved.
  if (!useProject.getState().project) {
    return reportFailure('assets.open', asset.name, new Error('no project'))
  }

  const created = await useDocuments
    .getState()
    .create(intent.workspace, { title: asset.name, sourceAssetId: asset.id })

  if (!created) return reportFailure('assets.open', asset.name, new Error('no document'))

  // `into` brings the tab forward, which is what switches workspace: the asset decides where the
  // user lands, not where they were.
  await intent.into(created.id, asset)
}
