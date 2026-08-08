import { isLocalPicture, type Asset } from '@shared/domain/asset'
import { pixelLayer } from '@/engines/canvas/canvas-state'
import { addLayer } from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { useCanvases } from '@/stores/canvases'

/**
 * A picture laid on a document as a layer of its own — what a drop, a double click and a
 * finished generation all end in.
 *
 * The asset is written into the layer rather than drawn at the engine: pixels pushed from here
 * would not survive an undo, a closed tab or a detached panel, and the engine only learns a
 * layer exists one React commit later anyway. It draws it the moment it builds the surface.
 *
 * The layer is named after the asset: a stack of "Layer 4, Layer 5, Layer 6" says nothing about
 * what is in it. `addLayer` arms it, so the brush lands on what was just dropped.
 */
export function placeAsset(documentId: string, asset: Asset): void {
  if (!isLocalPicture(asset)) return

  const layer = { ...pixelLayer(newId(), asset.name), source: asset.id }
  useCanvases.getState().runCommand(documentId, addLayer(layer))
}
