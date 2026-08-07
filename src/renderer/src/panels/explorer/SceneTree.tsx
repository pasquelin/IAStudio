import { mdiCubeOutline } from '@mdi/js'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { Tree, type TreeNode } from '@/design/Tree'
import type { SceneNode } from '@/engines/scene/scene-state'
import { SceneNodeRow } from '@/panels/shared/SceneNodeRow'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'

/** The synthetic root. It is not a node: it has no transform, no visibility and no delete. */
const SCENE_ROOT = 'scene-root'

type SceneItem = TreeNode & { node: SceneNode | null }

export function SceneTree({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedId = useScenes(state => sceneOf(state, documentId).selectedId)
  // Folding is session state: nobody wants Cmd-Z to give them back a collapsed branch.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set([SCENE_ROOT]))

  const items = useMemo<SceneItem[]>(
    () => [
      { id: SCENE_ROOT, parentId: null, node: null },
      ...nodes.map(node => ({ id: node.id, parentId: node.parentId ?? SCENE_ROOT, node })),
    ],
    [nodes],
  )

  return (
    <Tree
      nodes={items}
      selectedId={selectedId}
      expandedIds={expandedIds}
      onSelect={id => selectIn(documentId, id === SCENE_ROOT ? null : id)}
      onToggle={id =>
        setExpandedIds(current => {
          const next = new Set(current)
          if (!next.delete(id)) next.add(id)
          return next
        })
      }
      renderRow={({ node: item }) =>
        item.node ? (
          <SceneNodeRow
            documentId={documentId}
            node={item.node}
            visibleLabel={t('scene.visible')}
          />
        ) : (
          <Row icon={mdiCubeOutline} title={t('scene.root')} />
        )
      }
    />
  )
}
