import { newTexture, type TextureState } from '@/engines/texture/textureState'
import { createDocumentStore } from './documentStore'

/** One texture per document, with its own history — spec § 8.3. */
const store = createDocumentStore<TextureState>(newTexture())

export const textureStore = store
export const useTextures = store.use
export const textureOf = store.stateOf
export const textureHistoryOf = store.historyOf
export const isTextureDirty = store.isDirty
