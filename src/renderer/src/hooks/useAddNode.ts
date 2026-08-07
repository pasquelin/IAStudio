import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { addNode } from '@/engines/scene/commands'
import { createNodeOf, labelKeyOf } from '@/engines/scene/node-factory'
import { useScenes } from '@/stores/scenes'

/**
 * The one way a node enters a scene, whatever asked for it — the toolbar, a panel's add menu,
 * the native menu. Three call sites naming and placing a node their own way is three ways for
 * them to drift apart.
 *
 * A kind no registry claims, or one declared but not buildable yet, adds nothing.
 */
export function useAddNode(documentId: string | null): (kind: string) => void {
  const { t } = useTranslation()

  return useCallback(
    (kind: string) => {
      if (!documentId) return
      const labelKey = labelKeyOf(kind)
      // The node is named after the menu row that made it, as the three.js editor does.
      const node = createNodeOf(kind, labelKey ? t(labelKey) : kind)
      if (node) useScenes.getState().runCommand(documentId, addNode(node))
    },
    [documentId, t],
  )
}
