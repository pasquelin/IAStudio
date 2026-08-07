import { mdiVideoVintage } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import { TimelineCanvas } from '@/spaces/video/TimelineCanvas'
import { VIDEO_TOOLS, isVideoTool } from '@/spaces/video/video-tools'
import { useDocuments } from '@/stores/documents'
import { historyOf, useSequences } from '@/stores/sequences'
import { useVideoTool } from '@/stores/video-tool'
import { TrackHeaders } from './TrackHeaders'

/**
 * The montage of whatever sequence is in front. A tool window has no props — it sits on the
 * edge, outside Dockview — so it follows the active tab rather than being handed one.
 */
export function TimelinePanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(state => state.activeId)
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

/** The montage tools and the history, rendered by `ToolWindow` on the panel's own title bar. */
export function TimelineActions() {
  const documentId = useDocuments(state => state.activeId)
  const tool = useVideoTool(state => state.tool)
  const setTool = useVideoTool(state => state.setTool)

  const undoable = useSequences(state =>
    documentId ? canUndo(historyOf(state, documentId)) : false,
  )
  const redoable = useSequences(state =>
    documentId ? canRedo(historyOf(state, documentId)) : false,
  )

  if (!documentId) return null

  return (
    <Toolbar
      orientation="horizontal"
      className="border-none bg-transparent p-0 shadow-none"
      tools={[...VIDEO_TOOLS]}
      activeTool={tool}
      onTool={id => isVideoTool(id) && setTool(id)}
      onUndo={() => useSequences.getState().undo(documentId)}
      onRedo={() => useSequences.getState().redo(documentId)}
      canUndo={undoable}
      canRedo={redoable}
    />
  )
}
