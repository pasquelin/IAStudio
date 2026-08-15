import {
  DEFAULT_CANVAS,
  layerById,
  type CanvasState,
  type Layer,
} from '@/engines/canvas/canvas-state'
import { canvasOf, useCanvases } from './canvases'
import { installDocument } from './document-fixtures'

/**
 * Puts an image document in front of a panel under test, history cleared.
 *
 * Lives beside the stores rather than beside `layerFixture` for the same reason `installScene`
 * does: `engines/` must not reach for a store.
 */
export function installCanvas(documentId: string, state: CanvasState = DEFAULT_CANVAS): void {
  useCanvases.setState({ states: { [documentId]: state }, histories: {} })
  installDocument(documentId, 'image')
}

/**
 * Reading half of `installCanvas`, for what a suite asserts BETWEEN renders.
 *
 * Where the scene answers `null` for a document the store lost, this one falls back to the DEFAULT
 * canvas — which holds exactly one layer, `layer-1`. So a lost document answers `Background` under
 * that id and `null` under any other, `layer-2` included: neither answer tells a lost document
 * apart from a missing layer, and an isolation assertion needs its own non-null guard.
 */
export const layerNow = (documentId: string, id: string): Layer | null =>
  layerById(canvasOf(useCanvases.getState(), documentId), id)
