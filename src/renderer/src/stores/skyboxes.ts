import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { createDocumentStore } from './document-store'

/** One skybox per document, with its own history — spec § 8.3. */
const store = createDocumentStore<SkyboxContent>(createSkyboxContent())

export const useSkyboxes = store.use
export const skyboxOf = store.stateOf
export const historyOf = store.historyOf
