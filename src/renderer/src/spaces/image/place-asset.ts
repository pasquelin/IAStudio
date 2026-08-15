import { isLocalPicture, type Asset } from '@shared/domain/asset'
import { DEFAULT_CANVAS, pixelLayer, type CanvasState } from '@/engines/canvas/canvas-state'
import { addLayer } from '@/engines/canvas/commands'
import { newId } from '@/helpers/ids'
import { reportFailure } from '@/services/diagnostics'
import { canvasStore, useCanvases } from '@/stores/canvases'
import type { PictureMeasure } from './picture-size'

/**
 * A picture laid on a document as a layer of its own — what a drop and a finished generation
 * end in.
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

/**
 * The document IS the picture — what a double-click on an asset makes.
 *
 * NOT `placeAsset` on a fresh canvas, and the difference is what ⌘S is allowed to write back. A
 * default canvas is 1024² with an opaque WHITE base layer, so a 4096×2048 photo opened that way
 * became a white-matted top-left quarter of itself — and flattening that over the asset deleted
 * the original. Here the document takes the picture's own size and holds one layer with no
 * fill, so the flatten is the picture, transparency included.
 *
 * `replace`, never a command, and marked saved straight after: opening is not something ⌘Z gives
 * back, and a history entry would leave the tab MODIFIED before the user has touched it — which
 * is exactly what tells ⌘S whether the asset behind it may be rewritten. `placeAsset` runs
 * `addLayer` as a command, which is why it cannot be the one that opens an asset.
 *
 * A picture that will not decode opens at the default size rather than not at all: the layer
 * still names its source, so the engine draws it, and the size guard on `writeAsset` then keeps
 * ⌘S off an asset this document does not faithfully carry.
 */
export async function becomeAsset(
  documentId: string,
  asset: Asset,
  measure?: PictureMeasure,
): Promise<void> {
  if (!isLocalPicture(asset)) return

  // Reached through `import()`: this module is in the opening chunk — `eager-graph.test.ts`
  // holds that budget at two files — and measuring only ever happens on a double-click.
  const { measureAsset, withinCeiling } = await import('./picture-size')
  const measured = await measureAsset(asset.id, measure)
  const size = measured ? withinCeiling(measured) : DEFAULT_CANVAS
  // Said out loud EVERY way the document can fail to be the picture, because ⌘S writes the
  // document's size back over the asset: one opened smaller than it is would be saved smaller
  // than it was, and that has to be a thing the user was told rather than one the studio did
  // quietly. The ceiling biting was said; the file that would not decode was NOT, and that
  // silence is how a 4112 × 2658 photo came to sit in a 1024² document and be overwritten by it.
  if (!measured) {
    reportFailure('canvas.size', asset.name, new Error('picture would not measure'))
  } else if (size.width !== measured.width || size.height !== measured.height) {
    reportFailure('canvas.size', asset.name, new Error('picture opened below its own size'))
  }
  const layer = { ...pixelLayer(newId(), asset.name), source: asset.id }
  const state: CanvasState = {
    ...DEFAULT_CANVAS,
    width: size.width,
    height: size.height,
    layers: [layer],
    activeLayerId: layer.id,
  }

  const canvases = useCanvases.getState()
  canvases.replace(documentId, state)
  // Read after the replace, like `install` does: the mark describes the state now in the store.
  canvases.markSaved(documentId, canvasStore.markOf(useCanvases.getState(), documentId))
}
