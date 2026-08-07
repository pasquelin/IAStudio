import { mdiShapeOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { MESH_PRIMITIVES, primitiveByKind } from '@/engines/scene/mesh-primitives'
import type { SceneNode } from '@/engines/scene/scene-state'
import { useDocuments } from '@/stores/documents'
import { NodeActions } from '../shared/NodeActions'
import { NodeList } from '../shared/NodeList'

/**
 * The meshes of whatever scene is in front. A tool window has no props — it sits on the edge,
 * outside Dockview — so it follows the active tab rather than being handed one.
 */
export function MeshesPanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(state => state.activeId)

  if (!documentId) return <EmptyState icon={mdiShapeOutline} message={t('meshes.noDocument')} />
  return (
    <NodeList
      documentId={documentId}
      type="mesh"
      emptyIcon={mdiShapeOutline}
      emptyKey="meshes.empty"
      visibleKey="meshes.visible"
      iconFor={iconFor}
    />
  )
}

export function MeshesActions() {
  const documentId = useDocuments(state => state.activeId)

  if (!documentId) return null
  return (
    <NodeActions
      documentId={documentId}
      type="mesh"
      entries={MESH_PRIMITIVES}
      addKey="meshes.add"
      addHintKey="meshes.addHint"
      removeKey="meshes.remove"
      removeHintKey="meshes.removeHint"
    />
  )
}

function iconFor(node: SceneNode): string {
  if (node.type !== 'mesh') return mdiShapeOutline
  return primitiveByKind(node.geometry.kind)?.icon ?? mdiShapeOutline
}
