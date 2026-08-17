import { useScenes } from '@/stores/scenes'
import { useDocumentEdit, type DocumentEdit } from './useDocumentEdit'
import type { SceneState } from '@/engines/scene/sceneState'

export type SceneEdit = DocumentEdit<SceneState>

export function useSceneEdit(documentId: string): SceneEdit {
  return useDocumentEdit(useScenes, documentId)
}
