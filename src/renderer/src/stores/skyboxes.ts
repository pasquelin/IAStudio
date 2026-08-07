import { isLocalPicture, type Asset } from '@shared/domain/asset'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { applyGeneration } from '@/engines/skybox/commands'
import { generationOf } from '@/helpers/generation'
import { createDocumentStore } from './document-store'
import { useJobs } from './jobs'

/** One skybox per document, with its own history — spec § 8.3. */
const store = createDocumentStore<SkyboxContent>(createSkyboxContent())

export const useSkyboxes = store.use
export const skyboxOf = store.stateOf
export const historyOf = store.historyOf

/**
 * Hangs a picture of the project in a given sky. The target is passed rather than read off the
 * active tab: a drop knows which viewport it landed in, and two skybox panels can sit side by
 * side in one Dockview group — asking which is in front would write into the wrong one.
 *
 * Silence rather than a throw when the asset will not do, like `addAssetToSequence`: this
 * hangs off a double-click and a drop, both of which can land on anything.
 *
 * Any picture goes, whichever shelf it came from — the same equirectangular file is an `image`
 * when imported, a `skybox` when generated, a `texture` when produced as one. It must be on
 * disk: `assetUrl` resolves an id against the catalogue, and a cloud asset answers 404, which
 * the engine has no way to tell from a sky that is simply black.
 */
export function setSkyboxSource(documentId: string, asset: Asset): void {
  if (!isLocalPicture(asset)) return

  store.use
    .getState()
    .runCommand(documentId, applyGeneration({ assetId: asset.id }, provenanceOf(asset)))
}

/**
 * Where a picture came from, as a sky records it — `params` dropped, since a document is not a
 * form and "regenerate" reads the job rather than this.
 *
 * Resolved for every picture that lands, not only for generated ones: a photograph dropped over
 * a generated sky answers nothing here, and writing that nothing is the point. Leaving the
 * previous prompt in place would credit it with a picture it did not make — which is exactly
 * what the panel then shows under "what produced this sky".
 */
function provenanceOf(asset: Asset): SkyboxContent['generation'] {
  const { jobs, bodies } = useJobs.getState()
  const generation = generationOf(asset, jobs, bodies)
  if (!generation) return undefined

  const { modelId, modelLabel, prompt, seed } = generation
  return { modelId, modelLabel, prompt, seed }
}
