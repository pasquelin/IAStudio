import { useTranslation } from 'react-i18next'
import type { ToolDefinition } from '@/app/tool-components'
import { EmptyState } from '@/design/EmptyState'
import type { SceneNodeType } from '@/engines/scene/scene-state'
import { activeIdOfKind, useDocuments, type DocumentsSlice } from '@/stores/documents'
import { NODE_KINDS } from './node-kinds'

const activeSceneId = (state: DocumentsSlice): string | null => activeIdOfKind(state, 'scene')
import { NodeActions } from './NodeActions'
import { NodeList } from './NodeList'

/**
 * A panel over one half of the scene. Both halves behave identically — only the registry, the
 * glyph and the i18n namespace differ, and all three come from `NODE_KINDS`.
 *
 * A tool window has no props: it sits on the edge, outside Dockview, so it follows the active
 * tab rather than being handed one.
 */
export function nodePanel(type: SceneNodeType): Required<ToolDefinition> {
  const { icon, namespace } = NODE_KINDS[type]

  function Content() {
    const { t } = useTranslation()
    const documentId = useDocuments(activeSceneId)

    if (!documentId) return <EmptyState icon={icon} message={t(`${namespace}.noDocument`)} />
    return <NodeList documentId={documentId} type={type} />
  }

  function Actions() {
    const documentId = useDocuments(activeSceneId)

    if (!documentId) return null
    return <NodeActions documentId={documentId} type={type} />
  }

  return { Content, Actions }
}
