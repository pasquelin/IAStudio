import { collapseLayer, selectLayer } from '@/engines/canvas/commands'
import { DEFAULT_CANVAS, type CanvasState } from '@/engines/canvas/canvas-state'
import { createDocumentStore } from './document-store'

/**
 * One layer stack per document. The pixels are not here — they live in a GPU texture per layer,
 * owned by `CanvasEngine`.
 */
const store = createDocumentStore<CanvasState>(DEFAULT_CANVAS)

export const useCanvases = store.use
export const canvasOf = store.stateOf
export const historyOf = store.historyOf
export const hasCanvas = store.hasState
export const markOf = store.markOf

/**
 * Selection stays out of the history, so it writes the whole canvas back — and the canvas has
 * to be read at call time, not from the render that drew the row: a copy taken before whatever
 * command ran in between would undo it.
 */
export function selectLayerIn(documentId: string, id: string | null): void {
  const state = useCanvases.getState()
  state.replace(documentId, selectLayer(canvasOf(state, documentId), id))
}

/** Folding a group is a way of looking at the stack, not an edit of it — so it adds no entry. */
export function collapseLayerIn(documentId: string, id: string, collapsed: boolean): void {
  const state = useCanvases.getState()
  state.replace(documentId, collapseLayer(canvasOf(state, documentId), id, collapsed))
}
