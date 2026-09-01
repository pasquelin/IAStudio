import { newMaterial, type MaterialState } from '@/engines/material/materialState'
import { installIn } from './document-fixtures'
import { materialStore } from './materials'

/**
 * Puts a material document in front of a panel under test, in a store put back as it was built.
 *
 * Beside the stores rather than beside the material state, for the reason `installScene` gives:
 * `engines/` must not reach for a store.
 */
export function installMaterial(documentId: string, state: MaterialState = newMaterial()): void {
  installIn(materialStore, documentId, state, 'materials')
}
