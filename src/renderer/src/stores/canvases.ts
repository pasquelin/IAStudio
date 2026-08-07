import { create } from 'zustand'
import { emptyHistory, redo, run, undo, type Command, type History } from '@/engines/core/history'
import { DEFAULT_CANVAS, type CanvasState } from '@/engines/canvas/canvas-state'

type CanvasesState = {
  canvases: Record<string, CanvasState>
  histories: Record<string, History<CanvasState>>
  runCommand: (documentId: string, command: Command<CanvasState>) => void
  setCanvas: (documentId: string, state: CanvasState) => void
  undoCanvas: (documentId: string) => void
  redoCanvas: (documentId: string) => void
  dropCanvas: (documentId: string) => void
}

type Readable = Pick<CanvasesState, 'canvases' | 'histories'>

export function canvasOf(state: Readable, documentId: string): CanvasState {
  return state.canvases[documentId] ?? DEFAULT_CANVAS
}

export function historyOf(state: Readable, documentId: string): History<CanvasState> {
  return state.histories[documentId] ?? emptyHistory<CanvasState>()
}

/**
 * One layer stack and **one history per document**, as spec §8.3 requires: ⌘Z undoes the last
 * action of the active document, not of whatever was edited last anywhere.
 *
 * The pixels are not here — they live in a GPU texture per layer, owned by `CanvasEngine`.
 */
export const useCanvases = create<CanvasesState>()((set, get) => {
  /**
   * `run`, `undo` and `redo` share one signature, so the three actions share one body: read the
   * document's pair, step it, write it back.
   */
  const step = (
    documentId: string,
    apply: (
      canvas: CanvasState,
      history: History<CanvasState>,
    ) => [CanvasState, History<CanvasState>],
  ): void => {
    const [canvas, history] = apply(canvasOf(get(), documentId), historyOf(get(), documentId))
    set(state => ({
      canvases: { ...state.canvases, [documentId]: canvas },
      histories: { ...state.histories, [documentId]: history },
    }))
  }

  return {
    canvases: {},
    histories: {},

    runCommand: (documentId, command) =>
      step(documentId, (canvas, history) => run(canvas, history, command)),

    // Selection is not a command, so it lands here rather than in the history.
    setCanvas: (documentId, canvas) =>
      set(state => ({ canvases: { ...state.canvases, [documentId]: canvas } })),

    undoCanvas: documentId => step(documentId, undo),

    redoCanvas: documentId => step(documentId, redo),

    dropCanvas: documentId =>
      set(state => {
        const canvases = { ...state.canvases }
        const histories = { ...state.histories }
        delete canvases[documentId]
        delete histories[documentId]
        return { canvases, histories }
      }),
  }
})
