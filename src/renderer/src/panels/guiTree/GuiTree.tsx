import { mdiViewDashboardOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { activeGuiId, useDocuments } from '@/stores/documents'
import { GuiOutliner } from './GuiOutliner'

/**
 * The outliner of the interface in front. Its own tool rather than a face of the scene's: the
 * 3D space opens two kinds now, and one panel answering for both would answer for neither.
 */
export function GuiTree() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeGuiId)

  if (!documentId) {
    return <EmptyState icon={mdiViewDashboardOutline} message={t('gui.noDocument')} />
  }
  return <GuiOutliner documentId={documentId} />
}
