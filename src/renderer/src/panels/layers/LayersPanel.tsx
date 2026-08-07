import { mdiLayersOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { activeImageId, useDocuments } from '@/stores/documents'
import { LayerList } from './LayerList'

/**
 * The layer stack of whatever image is in front. A tool window has no props — it sits on the
 * edge, outside Dockview — so it follows the active tab rather than being handed one, and asks
 * for the image kind: a scene handed to `useCanvases` would grow a phantom stack of its own.
 *
 * It renders no header and no scroller of its own: `ToolWindow` wraps every tool in both, and a
 * second copy of either shows up as a doubled title bar and nested scrollbars.
 */
export function LayersPanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeImageId)

  if (!documentId) return <EmptyState icon={mdiLayersOutline} message={t('layers.noDocument')} />
  return <LayerList documentId={documentId} />
}
