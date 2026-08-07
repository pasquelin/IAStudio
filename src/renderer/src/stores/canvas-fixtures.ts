import { DEFAULT_CANVAS, type CanvasState } from '@/engines/canvas/canvas-state'
import { useCanvases } from './canvases'
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
