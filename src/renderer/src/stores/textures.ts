import { newTexture, type TextureState } from '@/engines/texture/texture-state'
import { createDocumentStore } from './document-store'

/** One texture per document, with its own history — spec § 8.3. */
const store = createDocumentStore<TextureState>(newTexture())

export const useTextures = store.use
export const textureOf = store.stateOf
export const historyOf = store.historyOf
