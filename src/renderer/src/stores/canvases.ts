import { createDocumentStore } from './document-store'
import { DEFAULT_CANVAS, type CanvasState } from '@/engines/canvas/canvas-state'

/**
 * One layer stack per document. The pixels are not here — they live in a GPU texture per layer,
 * owned by `CanvasEngine`.
 */
const store = createDocumentStore<CanvasState>(DEFAULT_CANVAS)

export const useCanvases = store.use
export const canvasOf = store.stateOf
export const historyOf = store.historyOf
