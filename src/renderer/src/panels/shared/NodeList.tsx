import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { Row } from '@/design/Row'
import { selectNode, setNodeVisible } from '@/engines/scene/commands'
import { iconOf } from '@/engines/scene/node-factory'
import { nodesOfType, type SceneNodeType } from '@/engines/scene/scene-state'
import { LIST_ONLY } from '@/helpers/collection-state'
import { sceneOf, useScenes } from '@/stores/scenes'
import { NODE_KINDS } from './node-kinds'
import { VisibilityToggle } from './VisibilityToggle'

/** A row carries an eye and a name — no thumbnail, so one line is enough. */
const ROW_HEIGHT = 24

/**
 * The mesh and light panels, which differ only by the slice of the scene they show. Selection,
 * keyboard reach and virtualization come from `Collection`; the line comes from `Row`. Neither
 * is rewritten here, which is the whole point of both existing.
 */
export function NodeList({ documentId, type }: { documentId: string; type: SceneNodeType }) {
  const { t } = useTranslation()
  const { icon, namespace } = NODE_KINDS[type]

  // Two selectors rather than the whole scene: `selectNode` keeps `nodes` identity, so a
  // selection click no longer re-renders the list it did not change.
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedId = useScenes(state => sceneOf(state, documentId).selectedId)
  const store = useScenes.getState()

  const shown = useMemo(() => nodesOfType({ nodes, selectedId }, type), [nodes, selectedId, type])
  const visibleLabel = t(`${namespace}.visible`)

  return (
    <Collection
      items={shown}
      state={LIST_ONLY}
      selectedId={selectedId}
      // Read at call time, not from the render that drew the row: selection writes the whole
      // scene back, and a stale copy would undo whatever command ran in between.
      onSelect={node =>
        store.replace(documentId, selectNode(sceneOf(useScenes.getState(), documentId), node.id))
      }
      rowHeight={ROW_HEIGHT}
      renderRow={node => (
        <Row
          icon={iconOf(node)}
          title={node.name}
          muted={!node.visible}
          leading={
            <VisibilityToggle
              visible={node.visible}
              label={visibleLabel}
              onToggle={() => store.runCommand(documentId, setNodeVisible(node.id, !node.visible))}
            />
          }
        />
      )}
      empty={<EmptyState icon={icon} message={t(`${namespace}.empty`)} />}
    />
  )
}
