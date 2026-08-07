import { mdiCubeOutline } from '@mdi/js'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { Tree, type TreeNode } from '@/design/Tree'
import { selectNode, setNodeVisible } from '@/engines/scene/commands'
import { iconOf } from '@/engines/scene/node-factory'
import type { SceneNode } from '@/engines/scene/scene-state'
import { VisibilityToggle } from '@/panels/shared/VisibilityToggle'
import { sceneOf, useScenes } from '@/stores/scenes'

/** The synthetic root. It is not a node: it has no transform, no visibility and no delete. */
const SCENE_ROOT = 'scene-root'

type SceneItem = TreeNode & { node: SceneNode | null }

export function SceneTree({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedId = useScenes(state => sceneOf(state, documentId).selectedId)
  // Folding is session state: nobody wants Cmd-Z to give them back a collapsed branch.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set([SCENE_ROOT]))
  const store = useScenes.getState()

  const items = useMemo<SceneItem[]>(
    () => [
      { id: SCENE_ROOT, parentId: null, node: null },
      ...nodes.map(node => ({ id: node.id, parentId: node.parentId ?? SCENE_ROOT, node })),
    ],
    [nodes],
  )

  // Read at call time, not from the render that drew the row: selection writes the whole scene
  // back, and a stale copy would undo whatever command ran in between.
  const select = (id: string): void =>
    store.replace(
      documentId,
      selectNode(sceneOf(useScenes.getState(), documentId), id === SCENE_ROOT ? null : id),
    )

  return (
    <Tree
      nodes={items}
      selectedId={selectedId}
      expandedIds={expandedIds}
      onSelect={select}
      onToggle={id =>
        setExpandedIds(current => {
          const next = new Set(current)
          if (!next.delete(id)) next.add(id)
          return next
        })
      }
      renderRow={({ node: item }) => (
        <Row
          icon={item.node ? iconOf(item.node) : mdiCubeOutline}
          title={item.node?.name ?? t('scene.root')}
          muted={item.node !== null && !item.node.visible}
          leading={
            item.node && (
              <VisibilityToggle
                visible={item.node.visible}
                label={t('scene.visible')}
                onToggle={() => {
                  const target = item.node
                  if (target) {
                    store.runCommand(documentId, setNodeVisible(target.id, !target.visible))
                  }
                }}
              />
            )
          }
        />
      )}
    />
  )
}
