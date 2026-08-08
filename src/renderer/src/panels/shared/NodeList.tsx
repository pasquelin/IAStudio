import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { LIST_ROW_HEIGHT } from '@/design/styles'
import { NODE_KINDS, type PanelNodeType } from '@/engines/scene/node-kinds'
import { nodesOfType } from '@/engines/scene/scene-state'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { SceneNodeRow } from './SceneNodeRow'

/** The meshes or the lights of the scene in front, listed. */
export function NodeList({ documentId, type }: { documentId: string; type: PanelNodeType }) {
  const { t } = useTranslation()
  const { icon, namespace } = NODE_KINDS[type]

  // Two selectors rather than the whole scene: `setSelection` keeps `nodes` identity, so a
  // selection click no longer rebuilds the list it did not change.
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)

  const shown = useMemo(() => nodesOfType(nodes, type), [nodes, type])
  const visibleLabel = t(`${namespace}.visible`)

  return (
    <Collection
      items={shown}
      selectedIds={selectedIds}
      // The panel lists half the scene, so a range here spans meshes or lights, never both —
      // which is what the list draws, and therefore what the gesture is allowed to mean.
      onSelect={(_node, ids, mode) => selectIn(documentId, ids, mode)}
      rowHeight={LIST_ROW_HEIGHT}
      renderRow={node => (
        <SceneNodeRow documentId={documentId} node={node} visibleLabel={visibleLabel} />
      )}
      empty={<EmptyState icon={icon} message={t(`${namespace}.empty`)} />}
    />
  )
}
