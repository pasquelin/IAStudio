import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { installIn } from './document-fixtures'
import { skyboxStore } from './skyboxes'

/**
 * Puts a sky in front of a panel under test, in a store put back as it was built.
 *
 * The fifth of the `install<X>` family, and it lives beside the stores for the reason
 * `installScene` gives: `engines/` must not reach for a store.
 */
export function installSkybox(
  documentId: string,
  content: SkyboxContent = createSkyboxContent(),
): void {
  installIn(skyboxStore, documentId, content, 'skyboxes')
}
