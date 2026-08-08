import { newTexture, type TextureState } from '@/engines/texture/texture-state'
import { installDocument } from './document-fixtures'
import { useTextures } from './textures'

/**
 * Puts a texture document in front of a panel under test, history cleared.
 *
 * Beside the stores rather than beside the texture state, for the reason `installScene` gives:
 * `engines/` must not reach for a store.
 */
export function installTexture(documentId: string, state: TextureState = newTexture()): void {
  useTextures.setState({ states: { [documentId]: state }, histories: {}, saved: {} })
  installDocument(documentId, 'textures')
}
