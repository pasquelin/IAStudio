import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { installDocument } from './document-fixtures'
import { useSkyboxes } from './skyboxes'

/**
 * Puts a sky in front of a panel under test, history and save mark cleared.
 *
 * The fifth of the `install<X>` family, and it lives beside the stores for the reason
 * `installScene` gives: `engines/` must not reach for a store. `saved` is reset like the scene
 * and the texture do — a suite that opens a document has never saved it, and leaving the key
 * behind makes `hasUnsavedWork` answer for the previous case.
 */
export function installSkybox(
  documentId: string,
  content: SkyboxContent = createSkyboxContent(),
): void {
  useSkyboxes.setState({ states: { [documentId]: content }, histories: {}, saved: {} })
  installDocument(documentId, 'skyboxes')
}
