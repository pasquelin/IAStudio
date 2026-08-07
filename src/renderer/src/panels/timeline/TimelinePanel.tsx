import { mdiVideoVintage } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { TimelineCanvas } from '@/spaces/video/TimelineCanvas'
import { activeSequenceId, useDocuments } from '@/stores/documents'
import { useVideoTool } from '@/stores/video-tool'
import { TrackHeaders } from './TrackHeaders'

/**
 * The montage of whatever sequence is in front. A tool window has no props — it sits on the
 * edge, outside Dockview — so it follows the active tab rather than being handed one, and asks
 * for the sequence kind: another document would give `useSequences` a montage of its own.
 */
export function TimelinePanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeSequenceId)
  const tool = useVideoTool(state => state.tool)

  if (!documentId) return <EmptyState icon={mdiVideoVintage} message={t('timeline.noDocument')} />

  return (
    <div className="flex h-full min-h-0">
      <TrackHeaders documentId={documentId} />
      <div className="min-w-0 flex-1">
        <TimelineCanvas documentId={documentId} tool={tool} />
      </div>
    </div>
  )
}
