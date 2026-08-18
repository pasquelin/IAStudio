import { getBridge } from '@/services/bridge'
import { documentExportName, useDocuments } from '@/stores/documents'

/** The engine, seen from an export: it flattens, and that is the whole of it. */
export type ExportHost = { snapshot: () => Promise<string | null> }

/**
 * Writes the document, flattened, wherever the user points. The stack is composited by the GPU
 * on the way out — the same pass the screen shows, so what lands on disk is what was judged.
 *
 * Returns the path, or `null` when the dialog was dismissed or there was nothing to write.
 */
export async function exportPicture(documentId: string, host: ExportHost): Promise<string | null> {
  const bridge = getBridge()
  if (!bridge) return null

  const image = await host.snapshot()
  if (!image) return null

  // The tab's own title, so the file is findable afterwards. A word rather than the id when there
  // is no title left to clean: an id is no more findable than a word, and shorter to read.
  const name = documentExportName(useDocuments.getState(), documentId, 'image')
  return bridge.dialog.exportPicture(`${name}.png`, image)
}
