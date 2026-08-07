import { createDefaultScene } from '@/engines/scene/default-scene'
import type { SceneState } from '@/engines/scene/scene-state'
import { installDocument } from './document-fixtures'
import { useScenes } from './scenes'

/** Clears the three per-document slices, so a suite never inherits the previous one's. */
export function clearScenes(): void {
  useScenes.setState({ states: {}, histories: {}, saved: {} })
}

/**
 * Puts a scene document in front of a panel under test, history cleared.
 *
 * It lives beside the stores rather than beside the node fixtures because their shape is what
 * it knows — and `engines/` must not reach for a store.
 */
export function installScene(documentId: string, state: SceneState = createDefaultScene()): void {
  useScenes.setState({ states: { [documentId]: state }, histories: {}, saved: {} })
  installDocument(documentId, '3d')
}
