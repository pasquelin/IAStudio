import { canMaskFromSelection } from '@/engines/canvas/canvasState'
import { setLayerMask } from '@/engines/canvas/commands'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { selectionOf, useCanvasViews } from '@/stores/canvasViews'

/** The engine, seen from this action: it carves pixels, which never live in the state. */
export type MaskHost = { fillMaskFromSelection: (layerId: string) => void }

/**
 * Turns the selection into the active layer's mask. The layer mask and the inpainting mask are
 * the same object — this is what makes a region drawn by hand something a model can be asked to
 * regenerate.
 *
 * Two steps because they belong to two sides: the mask itself is a command, undoable with the
 * rest of the stack, while its pixels are the engine's and are painted straight away.
 */
export function maskFromSelection(documentId: string, host: MaskHost): void {
  const canvas = canvasOf(useCanvases.getState(), documentId)
  const layerId = canvas.activeLayerId
  const selection = selectionOf(useCanvasViews.getState(), documentId)
  // The very test the menu greys its row with — read from both sides, like `canRemoveLayer`.
  if (!canMaskFromSelection(canvas, selection !== null) || !layerId || !selection) return

  useCanvases
    .getState()
    .runCommand(documentId, setLayerMask(layerId, { enabled: true, linked: true }))
  host.fillMaskFromSelection(layerId)
}
