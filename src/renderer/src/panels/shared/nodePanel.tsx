import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import type { ToolDefinition } from '@/panels/definition'
import { EmptyState } from '@/design/EmptyState'
import { NODE_KINDS, type PanelNodeType } from '@/engines/scene/nodeKinds'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { NodeActions } from './NodeActions'
import { NodeList } from './NodeList'

/**
 * A panel over one half of the scene. Both halves behave identically — only the registry, the
 * glyph and the i18n namespace differ, and all three come from `NODE_KINDS`.
 */
export function nodePanel(type: PanelNodeType): ToolDefinition & { Actions: FC } {
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
