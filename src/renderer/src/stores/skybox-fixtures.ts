import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { installDocument } from './document-fixtures'
import { useSkyboxes } from './skyboxes'

/**
 * Puts a sky in front of a panel under test, history and save mark cleared.
 *
 * The fifth of the `install<X>` family, and it lives beside the stores for the reason
 * `installScene` gives: `engines/` must not reach for a store. `saved` is cleared to match
 * `installScene` and `installTexture` rather than `installCanvas`, which does not — no case
 * here depends on it, and the point is that the five agree.
 */
export function installSkybox(
  documentId: string,
  content: SkyboxContent = createSkyboxContent(),
): void {
  useSkyboxes.setState({ states: { [documentId]: content }, histories: {}, saved: {} })
  installDocument(documentId, 'skyboxes')
}
