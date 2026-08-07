import { createDocumentStore } from './document-store'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/scene-state'

/** One scene per document, in memory like the documents themselves. */
const store = createDocumentStore<SceneState>(EMPTY_SCENE)

export const useScenes = store.use
export const sceneOf = store.stateOf
export const historyOf = store.historyOf
