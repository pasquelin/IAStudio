import { mdiFolderOpenOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { SceneTree } from './SceneTree'

/**
 * One panel whose content follows the active workspace. The project file tree is not written
 * yet, so every other workspace says so rather than showing an outliner from another space.
 */
export function Explorer() {
  const { t } = useTranslation()
  const workspace = useLayouts(state => state.activeWorkspace)
  const documentId = useDocuments(activeSceneId)

  // Its own wording, both times: an explorer that says "no project open" in the Image
  // workspace has the user hunting for a project that is right there.
  if (workspace !== '3d')
    return <EmptyState icon={mdiFolderOpenOutline} message={t('explorer.otherWorkspace')} />
  if (!documentId)
    return <EmptyState icon={mdiFolderOpenOutline} message={t('explorer.noDocument')} />
  return <SceneTree documentId={documentId} />
}
