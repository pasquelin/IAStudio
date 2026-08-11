import { createDefaultScene } from '@/engines/scene/default-scene'
import { nodeById, type SceneNode, type SceneState } from '@/engines/scene/scene-state'
import type { DocumentStoreState } from './document-store'
import { installDocument } from './document-fixtures'
import { sceneOf, useScenes } from './scenes'

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

/**
 * Reading half of `installScene`, in the shape a subscribed selector takes it.
 *
 * Named apart from the graph's `nodeIn` because the inspector suite installs both a graph and a
 * scene, and would otherwise import two readers under one name.
 */
export const sceneNodeIn = (
  state: DocumentStoreState<SceneState>,
  documentId: string,
  id: string,
): SceneNode | null => nodeById(sceneOf(state, documentId), id)

/**
 * The same read for what a suite asserts BETWEEN renders, where there is no state to be handed.
 *
 * `null` covers two different accidents — a node the scene does not hold, and a document the
 * store lost. `installScene` REPLACES the whole map, so installing a second scene turns the
 * first into the second accident silently.
 */
export const sceneNodeNow = (documentId: string, id: string): SceneNode | null =>
  sceneNodeIn(useScenes.getState(), documentId, id)
