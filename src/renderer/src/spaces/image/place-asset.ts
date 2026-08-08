import { assetUrl, isLocalPicture, type Asset } from '@shared/domain/asset'
import { pixelLayer } from '@/engines/canvas/canvas-state'
import { addLayer } from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { useCanvases } from '@/stores/canvases'
import { canvasHostOf } from './canvas-hosts'

/**
 * A picture laid on a document as a layer of its own — what a drop, a double click and a
 * finished generation all end in.
 *
 * The layer is named after the asset: a stack of "Layer 4, Layer 5, Layer 6" says nothing about
 * what is in it. `addLayer` arms it, so the brush lands on what was just dropped rather than
 * wherever it was before.
 */
export async function placeAsset(documentId: string, asset: Asset): Promise<void> {
  const host = canvasHostOf(documentId)
  if (!host || !isLocalPicture(asset)) return

  const layerId = newId()
  useCanvases.getState().runCommand(documentId, addLayer(pixelLayer(layerId, asset.name)))
  await host.loadInto(layerId, assetUrl(asset.id))
}
