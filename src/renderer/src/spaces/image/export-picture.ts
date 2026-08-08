import { getBridge } from '@/services/bridge'
import { useDocuments } from '@/stores/documents'

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

  // The tab's own title, so the file is findable afterwards — an opaque id is not.
  const title = useDocuments.getState().documents[documentId]?.title ?? documentId
  return bridge.dialog.exportPicture(`${fileNameOf(title)}.png`, image)
}

/** A title down to what a file system takes: separators and dots would name another folder. */
function fileNameOf(title: string): string {
  const cleaned = title
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\.+/g, ' ')
    .trim()
  return cleaned || 'image'
}
