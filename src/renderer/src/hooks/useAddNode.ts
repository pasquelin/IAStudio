import { useCallback } from 'react'
import { addNode } from '@/engines/scene/commands'
import { createNodeOf } from '@/engines/scene/nodeFactory'
import { useScenes } from '@/stores/scenes'

/** The one way a node enters a scene: the toolbar, a panel's add menu and the native menu. */
export function addNodeTo(documentId: string, kind: string): void {
  const node = createNodeOf(kind)
  if (node) useScenes.getState().runCommand(documentId, addNode(node))
}

/** The same, bound to the document a component already holds. */
export function useAddNode(documentId: string | null): (kind: string) => void {
  return useCallback(
    (kind: string) => {
      if (documentId) addNodeTo(documentId, kind)
    },
    [documentId],
  )
}
