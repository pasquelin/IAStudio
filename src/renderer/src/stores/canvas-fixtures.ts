import { DEFAULT_CANVAS, type CanvasState, type Layer } from '@/engines/canvas/canvas-state'
import { useCanvases } from './canvases'
import { useDocuments } from './documents'

/**
 * Puts an image document in front of a panel under test, history cleared. It declares the
 * descriptor too: the layer panels resolve their document through `activeIdOfKind`, so an id
 * with no descriptor behind it reads as "nothing open".
 *
 * Mirrors `installScene`, and lives beside the stores for the same reason.
 */
export function installCanvas(documentId: string, state: CanvasState = DEFAULT_CANVAS): void {
  useCanvases.setState({ states: { [documentId]: state }, histories: {} })
  useDocuments.setState({
    documents: {
      [documentId]: { id: documentId, kind: 'image', workspace: 'image', title: documentId },
    },
    activeId: documentId,
  })
}

/** A layer with every required field filled, so adding one breaks a single place. */
export function layerFixture(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'layer-2',
    name: 'Paint',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    ...overrides,
  }
}
