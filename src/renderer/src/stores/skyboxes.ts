import { isLocalPicture, type Asset } from '@shared/domain/asset'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { setSource } from '@/engines/skybox/commands'
import { activeIdOfKind, useDocuments } from './documents'
import { createDocumentStore } from './document-store'

/** One skybox per document, with its own history — spec § 8.3. */
const store = createDocumentStore<SkyboxContent>(createSkyboxContent())

export const useSkyboxes = store.use
export const skyboxOf = store.stateOf
export const historyOf = store.historyOf

/**
 * Hangs a picture of the project in the sky in front. Like `addAssetToSequence`, silence rather
 * than a throw when there is nowhere to put it: this hangs off a double-click and a drop, both
 * of which can land in any workspace.
 *
 * Any picture goes, whichever shelf it came from — the same equirectangular file is an `image`
 * when imported, a `skybox` when generated, a `texture` when produced as one. It must be on
 * disk: `assetUrl` resolves an id against the catalogue, and a cloud asset answers 404, which
 * the engine has no way to tell from a sky that is simply black.
 */
export function setSkyboxSource(asset: Asset): void {
  const documentId = activeIdOfKind(useDocuments.getState(), 'skybox')
  if (!documentId || !isLocalPicture(asset)) return

  store.use.getState().runCommand(documentId, setSource({ assetId: asset.id }))
}
