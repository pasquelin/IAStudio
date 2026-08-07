import { mdiFolderOpenOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { SceneTree } from './SceneTree'

/**
 * One panel whose content follows the active workspace. The file tree of a project is not
 * written yet; until it is, every other workspace keeps saying so rather than showing an
 * outliner that belongs to another space.
 */
export function Explorer() {
  const { t } = useTranslation()
  const workspace = useLayouts(state => state.activeWorkspace)
  const documentId = useDocuments(state => state.activeId)

  if (workspace !== '3d')
    return <EmptyState icon={mdiFolderOpenOutline} message={t('project.none')} />
  if (!documentId) return <EmptyState icon={mdiFolderOpenOutline} message={t('scene.noDocument')} />
  return <SceneTree documentId={documentId} />
}
