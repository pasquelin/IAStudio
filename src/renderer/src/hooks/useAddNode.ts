import { useCallback } from 'react'
import { addNode } from '@/engines/scene/commands'
import { createNodeOf } from '@/engines/scene/node-factory'
import { useScenes } from '@/stores/scenes'

/**
 * The one way a node enters a scene, whatever asked for it — the toolbar, a panel's add menu,
 * the native menu. Three call sites naming and placing a node their own way is three ways for
 * them to drift apart.
 *
 * A kind no registry claims, or one declared but not buildable yet, adds nothing.
 */
export function addNodeTo(documentId: string, kind: string): void {
  const node = createNodeOf(kind)
  if (node) useScenes.getState().runCommand(documentId, addNode(node))
}

/** The same, bound to a document a component already holds. */
export function useAddNode(documentId: string | null): (kind: string) => void {
  return useCallback(
    (kind: string) => {
      if (documentId) addNodeTo(documentId, kind)
    },
    [documentId],
  )
}
