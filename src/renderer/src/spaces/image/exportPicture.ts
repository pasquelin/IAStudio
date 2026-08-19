import { exportTargetOf } from '@shared/domain/exportRegistry'
import type { LayerPixels } from '@/engines/canvas/CanvasEngine'
import { bytesToBase64 } from '@/helpers/base64'
import { getBridge } from '@/services/bridge'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { documentExportName, useDocuments } from '@/stores/documents'

/**
 * The engine, seen from an export: it flattens, and — for the layered way out — hands over every
 * layer's pixels and the flatten the container requires.
 */
export type ExportHost = {
  snapshot: () => Promise<string | null>
  pixelSnapshots: () => Promise<readonly LayerPixels[]>
  flatten: () => Promise<Uint8Array<ArrayBuffer> | null>
}

/**
 * Writes the document, flattened, wherever the user points. The stack is composited by the GPU
 * on the way out — the same pass the screen shows, so what lands on disk is what was judged.
 *
 * Returns the path, or `null` when the dialog was dismissed or there was nothing to write.
 */
export async function exportPicture(documentId: string, host: ExportHost): Promise<string | null> {
  const bridge = getBridge()
  if (!bridge) return null

  // THROWS rather than answering `null`, and the difference is a message: `null` here means the
  // user dismissed the dialog, and an engine whose context is not up yet would look exactly the
  // same. The caller reports a rejection; it reports nothing at all for a dismissal.
  const image = await host.snapshot()
  if (!image) throw new Error('this image has no picture to export yet')

  // The tab's own title, so the file is findable afterwards. A word rather than the id when there
  // is no title left to clean: an id is no more findable than a word, and shorter to read.
  const name = documentExportName(useDocuments.getState(), documentId, 'image')
  return bridge.dialog.exportPicture(`${name}.png`, image)
}

/**
 * The same document with its layers intact, as a `.psd`.
 *
 * Through `exportPicture`'s own door — a PSD IS a picture, and that channel is « write these bytes
 * where the person points ». The stack is the one a save composes, so the two ways out of an image
 * describe the same tree.
 */
export async function exportLayeredPicture(
  documentId: string,
  host: ExportHost,
): Promise<string | null> {
  const bridge = getBridge()
  if (!bridge) return null

  const merged = await host.flatten()
  // The same refusal the save makes, and for the same reason: a stack read while the engine is
  // booting its GPU context is empty, and an empty PSD is a file that opens on nothing.
  if (!merged) throw new Error('this image has no picture to export yet')

  const { psdBytesOf } = await import('./psdDocument')
  const { oraStackOf, oraSurfacesOf } = await import('@/engines/canvas/oraDocument')

  const surfaces = oraSurfacesOf(await host.pixelSnapshots(), merged)
  const bytes = await psdBytesOf({
    stack: oraStackOf(canvasOf(useCanvases.getState(), documentId), surfaces),
    surfaces,
  })

  const name = documentExportName(useDocuments.getState(), documentId, 'image')
  return bridge.dialog.exportPicture(
    `${name}${exportTargetOf('picture.psd').extension}`,
    bytesToBase64(bytes),
  )
}
