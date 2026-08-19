import { exportTargetOf } from '@shared/domain/exportRegistry'
import type { FolderExportRequest } from '@shared/ipc'
import { documentExportName, useDocuments } from '@/stores/documents'
import { canvasHost } from './canvasHosts'

/**
 * The stack, flattened to one picture — the half of an export that has nothing to do with where it
 * lands. Composited by the GPU on the way out, the same pass the screen shows, so what is written
 * is what was judged.
 *
 * `dialog.exportPicture` takes base64 because that is what a snapshot IS; this writer takes bytes,
 * so the one place the two meet decodes it.
 */
export async function imageExportFiles(documentId: string): Promise<FolderExportRequest> {
  const host = canvasHost(documentId)
  if (!host) throw new Error('this image has no engine mounted to export from')

  const image = await host.snapshot()
  if (!image) throw new Error('this image has nothing to export yet')

  // The tab's own title, so the file is findable afterwards — an opaque id is not.
  const name = documentExportName(useDocuments.getState(), documentId, 'image')
  return {
    folder: name,
    files: [
      {
        name,
        extension: exportTargetOf('picture.png').extension,
        bytes: bytesOfDataUrl(image),
      },
    ],
  }
}

/** A `data:` URL down to its bytes. `atob` is the only decoder a renderer has without a fetch. */
function bytesOfDataUrl(image: string): Uint8Array {
  const binary = atob(image.slice(image.indexOf(',') + 1))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}
