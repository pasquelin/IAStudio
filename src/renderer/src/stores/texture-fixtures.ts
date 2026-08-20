import { newTexture, type TextureState } from '@/engines/texture/textureState'
import { installIn } from './document-fixtures'
import { textureStore } from './textures'

/**
 * Puts a texture document in front of a panel under test, in a store put back as it was built.
 *
 * Beside the stores rather than beside the texture state, for the reason `installScene` gives:
 * `engines/` must not reach for a store.
 */
export function installTexture(documentId: string, state: TextureState = newTexture()): void {
  installIn(textureStore, documentId, state, 'textures')
}
