import type { Asset } from '@shared/domain/asset'
import { openDocument } from '@/app/dockview-api'
import { reportFailure } from '@/services/diagnostics'
import { documentForAsset, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { editorIntent, type AssetIntent } from './asset-intents'

/**
 * What opening an asset does — double-click or Enter: a tab of its own, in the space that edits
 * its kind. The context menu and the drag keep the destinations of `ASSET_INTENTS`, which serve
 * the document already open; this gesture serves the asset.
 *
 * It never reads the tab in front, deliberately. Doing so made one gesture mean two things —
 * a picture became a layer over an image tab and a sky over a skybox one — and neither was
 * "open this asset". A rule with no exception is the only one a hand can learn.
 *
 * `into` names another destination — a texture's PIXELS, which are edited in Images while its
 * channels are assembled in Textures. It is a second gesture with a row of its own, never a
 * second meaning of the double-click, which stays the one rule a hand can learn.
 *
 * A refusal is said out loud, as it has to be: the same double-click worked over one tab and did
 * nothing at all over another, without a word either way.
 */
export async function openAsset(asset: Asset, into?: AssetIntent): Promise<void> {
  const intent = into ?? editorIntent(asset)
  const already = documentForAsset(useDocuments.getState(), asset.id, intent?.kind)
  // Back to its own tab rather than a second one onto the same asset: two tabs of one document
  // are two histories of it, and the second save writes over the first.
  if (already) {
    // The section is not set here: bringing the tab forward is what sets it, so the two cannot
    // disagree — see `DocumentArea`.
    openDocument(already)
    // The tab is NOT resized to the asset: it keeps its size and the work done in it. But one
    // that no longer measures its asset writes a smaller file over it on the next ⌘S, so the
    // destination says so here — the first moment the user can still act on it.
    return intent?.revisit?.(already.id, asset)
  }

  // `takes` before anything is made: an editor that would refuse the asset must say so rather
  // than leave an empty tab standing where a refusal belonged.
  if (!intent?.takes(asset)) {
    return reportFailure('assets.open', asset.name, new Error('no destination'))
  }

  // Every editor loads its subject from the file behind it — `assetUrl` resolves an id against
  // the catalogue, and one the cloud still holds answers 404. `takes` cannot see this for the
  // kinds whose destination has no picture guard, so the gesture asks it once, for all of them.
  if (asset.location !== 'local') {
    return reportFailure('assets.open', asset.name, new Error('not on disk'))
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

  // `become` where the destination offers one — the document IS the asset, rather than a blank
  // one the asset was dropped on. It is what leaves the tab unmodified on open, and what makes
  // ⌘S able to write a faithful flatten back.
  await (intent.become ?? intent.into)(created.id, asset)
}
