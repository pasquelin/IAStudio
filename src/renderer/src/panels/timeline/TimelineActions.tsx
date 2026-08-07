import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import { VIDEO_TOOLS, isVideoTool } from '@/spaces/video/video-tools'
import { activeSequenceId, useDocuments } from '@/stores/documents'
import { historyOf, useSequences } from '@/stores/sequences'
import { useVideoTool } from '@/stores/video-tool'

/** The montage tools and the history, rendered by `ToolWindow` on the panel's own title bar. */
export function TimelineActions() {
  const documentId = useDocuments(activeSequenceId)
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
