import { OTIO_EXTENSION } from '@shared/domain/otio'
import type { FolderExportRequest } from '@shared/ipc'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { documentExportName, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { otioTimelineFor, serializeSequencePayload } from './sequenceDocument'

/**
 * Absolute HERE and relative in the document: an export lands wherever the save dialog says, so
 * nothing about its own folder says where the project's media sits.
 */
function fileUrlsUnder(projectPath: string): (relative: string) => string {
  const root = projectPath.replaceAll('\\', '/').replace(/\/$/, '')

  return relative => {
    const url = new URL('file:///')
    // Through the parser rather than `encodeURIComponent`, which escapes the `:` of a Windows
    // drive letter too. The leading slash is what keeps that letter out of the host.
    url.pathname = root.startsWith('/') ? `${root}/${relative}` : `/${root}/${relative}`
    return url.href
  }
}

/**
 * The montage, encoded to one file — the half of an export that has nothing to do with where it
 * lands. Shared by the File menu and by the outside door, exactly as a scene's is.
 *
 * A folder for a single file, like every other door onto the folder writer. Throws when no
 * project is open — there is then no path to point a clip's media at.
 */
export function otioExportFiles(documentId: string): FolderExportRequest {
  const projectPath = useProject.getState().project?.path
  if (!projectPath) throw new Error('no project is open to resolve the media against')

  const timeline = otioTimelineFor(
    sequenceOf(useSequences.getState(), documentId),
    documentId,
    fileUrlsUnder(projectPath),
  )

  const name = documentExportName(useDocuments.getState(), documentId, 'edit')
  return {
    folder: name,
    files: [
      {
        name,
        extension: OTIO_EXTENSION,
        bytes: new TextEncoder().encode(serializeSequencePayload(timeline)),
      },
    ],
  }
}

/**
 * The File menu's half: the same encoding, written wherever the save dialog lands.
 *
 * Answers the file name, or `null` when the dialog was dismissed or nothing could be written.
 */
export async function exportOtio(documentId: string): Promise<string | null> {
  const bridge = getBridge()
  if (!bridge) return null

  try {
    const { folder, files } = otioExportFiles(documentId)
    const encoded = files[0]
    return encoded ? await bridge.montage.export({ name: folder, data: encoded.bytes }) : null
  } catch (error) {
    reportFailure('sequence.export', documentId, error)
    return null
  }
}
