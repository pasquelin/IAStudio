import { mdiLightbulbOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { lightByKind, LIGHT_TYPES } from '@/engines/scene/light-types'
import type { SceneNode } from '@/engines/scene/scene-state'
import { useDocuments } from '@/stores/documents'
import { NodeActions } from '../shared/NodeActions'
import { NodeList } from '../shared/NodeList'

/**
 * The lights of whatever scene is in front. A tool window has no props — it sits on the edge,
 * outside Dockview — so it follows the active tab rather than being handed one.
 */
export function LightsPanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(state => state.activeId)

  if (!documentId) return <EmptyState icon={mdiLightbulbOutline} message={t('lights.noDocument')} />
  return (
    <NodeList
      documentId={documentId}
      type="light"
      emptyIcon={mdiLightbulbOutline}
      emptyKey="lights.empty"
      visibleKey="lights.visible"
      iconFor={iconFor}
    />
  )
}

export function LightsActions() {
  const documentId = useDocuments(state => state.activeId)

  if (!documentId) return null
  return (
    <NodeActions
      documentId={documentId}
      type="light"
      entries={LIGHT_TYPES}
      addKey="lights.add"
      addHintKey="lights.addHint"
      removeKey="lights.remove"
      removeHintKey="lights.removeHint"
    />
  )
}

function iconFor(node: SceneNode): string {
  if (node.type !== 'light') return mdiLightbulbOutline
  return lightByKind(node.light.kind)?.icon ?? mdiLightbulbOutline
}
