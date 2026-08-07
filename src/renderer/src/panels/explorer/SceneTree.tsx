import { mdiCubeOutline, mdiEye, mdiEyeOffOutline } from '@mdi/js'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Row } from '@/design/Row'
import { ToolButton } from '@/design/ToolButton'
import { Tree, type TreeNode } from '@/design/Tree'
import { selectNode, setNodeVisible } from '@/engines/scene/commands'
import { lightByKind } from '@/engines/scene/light-types'
import { primitiveByKind } from '@/engines/scene/mesh-primitives'
import type { SceneNode } from '@/engines/scene/scene-state'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'

/** The synthetic root. It is not a node: it has no transform, no visibility and no delete. */
const SCENE_ROOT = 'scene-root'

type SceneItem = TreeNode & { node: SceneNode | null; label: string; icon: string }

export function SceneTree({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const scene = useScenes(state => sceneOf(state, documentId))
  // Folding is session state: nobody wants Cmd-Z to give them back a collapsed branch.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set([SCENE_ROOT]))
  const store = useScenes.getState()

  const items = useMemo<SceneItem[]>(
    () => [
      { id: SCENE_ROOT, parentId: null, node: null, label: t('scene.root'), icon: mdiCubeOutline },
      ...scene.nodes.map(node => ({
        id: node.id,
        parentId: node.parentId ?? SCENE_ROOT,
        node,
        label: node.name,
        icon: iconFor(node),
      })),
    ],
    [scene.nodes, t],
  )

  return (
    <Tree
      nodes={items}
      selectedId={scene.selectedId}
      expandedIds={expandedIds}
      onSelect={id => store.replace(documentId, selectNode(scene, id === SCENE_ROOT ? null : id))}
      onToggle={id =>
        setExpandedIds(current => {
          const next = new Set(current)
          if (!next.delete(id)) next.add(id)
          return next
        })
      }
      renderRow={({ node: item }) => (
        <Row
          icon={item.icon}
          title={item.label}
          muted={item.node !== null && !item.node.visible}
          leading={item.node && <VisibilityEye documentId={documentId} node={item.node} />}
        />
      )}
    />
  )
}

function VisibilityEye({ documentId, node }: { documentId: string; node: SceneNode }) {
  const { t } = useTranslation()

  return (
    <ToolButton
      icon={node.visible ? mdiEye : mdiEyeOffOutline}
      label={t('scene.visible')}
      tooltip={TIP_RIGHT}
      variant="header"
      // The row selects on pointer down, which fires before click: stopping the click alone
      // would still have let the eye steal the selection.
      onPointerDown={event => event.stopPropagation()}
      onClick={() =>
        useScenes.getState().runCommand(documentId, setNodeVisible(node.id, !node.visible))
      }
    />
  )
}

function iconFor(node: SceneNode): string {
  if (node.type === 'light') return lightByKind(node.light.kind)?.icon ?? mdiCubeOutline
  return primitiveByKind(node.geometry.kind)?.icon ?? mdiCubeOutline
}
