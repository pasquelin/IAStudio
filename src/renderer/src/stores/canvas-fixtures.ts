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
 * Where the scene answers `null` for a document the store lost, this one answers the layer the
 * DEFAULT canvas holds under that id — `canvasOf` falls back to a canvas that already has one.
 * A suite asserting on the wrong document therefore reads a layer, never a hole.
 */
export const layerNow = (documentId: string, id: string): Layer | null =>
  layerById(canvasOf(useCanvases.getState(), documentId), id)
