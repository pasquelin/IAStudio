import { activeSequenceId, useDocuments } from '@/stores/documents'
import { SequenceActions } from './SequenceActions'

/**
 * The montage tools and the history, rendered by `ToolWindow` on the panel's own title bar.
 * The bar is split off so its hooks never run without a sequence — as the layer panel does.
 */
export function TimelineActions() {
  const documentId = useDocuments(activeSequenceId)

  if (!documentId) return null
  return <SequenceActions documentId={documentId} />
}
