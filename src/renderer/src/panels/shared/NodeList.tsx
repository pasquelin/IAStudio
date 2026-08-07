import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { NODE_KINDS } from '@/engines/scene/node-kinds'
import { nodesOfType, type SceneNodeType } from '@/engines/scene/scene-state'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { SceneNodeRow } from './SceneNodeRow'

/** A row carries an eye and a name — no thumbnail, so one line is enough. */
const ROW_HEIGHT = 24

/** The meshes or the lights of the scene in front, listed. */
export function NodeList({ documentId, type }: { documentId: string; type: SceneNodeType }) {
  const { t } = useTranslation()
  const { icon, namespace } = NODE_KINDS[type]

  // Two selectors rather than the whole scene: `selectNode` keeps `nodes` identity, so a
  // selection click no longer rebuilds the list it did not change.
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedId = useScenes(state => sceneOf(state, documentId).selectedId)

  const shown = useMemo(() => nodesOfType(nodes, type), [nodes, type])
  const visibleLabel = t(`${namespace}.visible`)

  return (
    <Collection
      items={shown}
      selectedId={selectedId}
      onSelect={node => selectIn(documentId, node.id)}
      rowHeight={ROW_HEIGHT}
      renderRow={node => (
        <SceneNodeRow documentId={documentId} node={node} visibleLabel={visibleLabel} />
      )}
      empty={<EmptyState icon={icon} message={t(`${namespace}.empty`)} />}
    />
  )
}
