import { useState } from 'react'
import { Toolbar } from '@/design/Toolbar'
import { canRedo, canUndo } from '@/engines/core/history'
import { historyOf, useSequences } from '@/stores/sequences'
import { DEFAULT_VIDEO_TOOL, VIDEO_TOOLS } from './video-tools'

export type SequenceDocumentProps = { documentId: string }

/** Program monitor above, timeline below — the split lives inside the tab, never outside it. */
export function SequenceDocument({ documentId }: SequenceDocumentProps) {
  const [tool, setTool] = useState(DEFAULT_VIDEO_TOOL)

  // Booleans rather than the history itself: a selector building an object on every call hands
  // React a new snapshot each render, and the loop never settles.
  const undoable = useSequences(state => canUndo(historyOf(state, documentId)))
  const redoable = useSequences(state => canRedo(historyOf(state, documentId)))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="bg-chassis relative min-h-0 flex-1" />

      <div className="border-border bg-base relative h-64 shrink-0 border-t">
        <Toolbar
          className="absolute top-2 left-2 z-10"
          tools={[...VIDEO_TOOLS]}
          activeTool={tool}
          onTool={setTool}
          onUndo={() => useSequences.getState().undo(documentId)}
          onRedo={() => useSequences.getState().redo(documentId)}
          canUndo={undoable}
          canRedo={redoable}
        />
      </div>
    </div>
  )
}
