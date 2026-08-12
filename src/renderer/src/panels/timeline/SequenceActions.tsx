import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import { VIDEO_TOOLS, isVideoTool } from '@/spaces/video/video-tools'
import { sequenceHistoryOf, useSequences } from '@/stores/sequences'
import { useVideoTool } from '@/stores/video-tool'

/** The montage tools and the history of one sequence. */
export function SequenceActions({ documentId }: { documentId: string }) {
  const tool = useVideoTool(state => state.tool)
  const setTool = useVideoTool(state => state.setTool)
  const undoable = useSequences(state => canUndo(sequenceHistoryOf(state, documentId)))
  const redoable = useSequences(state => canRedo(sequenceHistoryOf(state, documentId)))

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
