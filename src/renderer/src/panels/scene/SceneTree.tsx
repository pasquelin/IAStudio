import { mdiCubeOutline } from '@mdi/js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { Tree, type TreeNode } from '@/design/Tree'
import { canReparent, type SceneNode } from '@/engines/scene/scene-state'
import { SceneNodeRow } from '@/panels/shared/SceneNodeRow'
import { reparentNode } from '@/engines/scene/commands'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'

/** The synthetic root. It is not a node: it has no transform, no visibility and no delete. */
const SCENE_ROOT = 'scene-root'

type SceneItem = TreeNode & { node: SceneNode | null }

export function SceneTree({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  // Folding is session state: nobody wants Cmd-Z to give them back a collapsed branch.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set([SCENE_ROOT]))
  // A group opens the first time it is seen, and can be folded afterwards: made by ⌘G it would
  // otherwise swallow the very nodes just put into it, and the outliner would look like it had
  // lost them. Folding it again has to stick, so this happens once per group and not per render.
  const known = useRef(new Set<string>())
  useEffect(() => {
    const fresh = nodes.filter(node => node.type === 'group' && !known.current.has(node.id))
    if (fresh.length === 0) return

    for (const group of fresh) known.current.add(group.id)
    setExpandedIds(current => new Set([...current, ...fresh.map(group => group.id)]))
  }, [nodes])

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
      label={t('panels.scene')}
      selectedIds={selectedIds}
      expandedIds={expandedIds}
      // The root is a row but not a node: clicking it selects nothing, and a range that spans
      // it steps over it rather than selecting a thing the scene has never heard of.
      selectable={item => item.node !== null}
      // The root stands for the scene, so dropping onto it is how a node comes back out of a
      // group.
      onDrop={(id, parentId) => {
        const wanted = parentId === SCENE_ROOT ? null : parentId
        const node = nodes.find(candidate => candidate.id === id)
        // Refused here rather than by the command: a move that changes nothing — dropping a row
        // back where it came from, the commonest gesture of the whole drag — would otherwise
        // leave a dead entry in the history, and a ⌘Z that appears to do nothing.
        if (!node || node.parentId === wanted || !canReparent(nodes, id, wanted)) return

        useScenes.getState().runCommand(documentId, reparentNode(id, wanted))
        // Opened, or the node just moved would vanish into a folded branch.
        if (wanted) setExpandedIds(current => new Set(current).add(wanted))
      }}
      onSelect={(ids, mode) => selectIn(documentId, ids, mode)}
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
