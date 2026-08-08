import { mdiFileTreeOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { SceneTree } from './SceneTree'

/**
 * The outliner of the scene in front. Its own tool rather than a face of the Explorer: the
 * Explorer lists the documents of the project, which is a different question asked in all six
 * workspaces — and the panel that answered both answered neither outside 3D.
 */
export function Scene() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeSceneId)

  if (!documentId) return <EmptyState icon={mdiFileTreeOutline} message={t('scene.noDocument')} />
  return <SceneTree documentId={documentId} />
}
