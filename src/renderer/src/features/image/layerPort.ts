import type { LayerPort } from '@/engines/canvas/CanvasEngine'
import { setLayerTransform, translateLayer } from '@/engines/canvas/commands'
import { useCanvases } from '@/stores/canvases'

/**
 * What the engine is allowed to do to the stack of one document. Same line as `guidePort`: the
 * engine knows where the pointer went, the history knows what that means.
 *
 * Dragging a layer is one gesture, so every step it emits carries the same command id and merges
 * into a single entry — and each step is an absolute position, because only the last one survives
 * the merge.
 */
export function layerPort(documentId: string): LayerPort {
  const store = () => useCanvases.getState()

  return {
    transform: (id, transform) => store().runCommand(documentId, setLayerTransform(id, transform)),
    translate: (id, x, y) => store().runCommand(documentId, translateLayer(id, x, y)),
    beginDrag: () => store().beginGesture(documentId),
    endDrag: () => store().endGesture(documentId),
  }
}
