import { exportTargetOf } from '@shared/domain/exportRegistry'
import { bundleOf } from '@shared/domain/otioz'
import type { FolderExportRequest } from '@shared/ipc'
import { newId } from '@/helpers/ids'
import { assetsById, useAssets } from '@/stores/assets'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { documentExportName, useDocuments } from '@/stores/documents'
import { runTask } from '@/stores/tasks'
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

  // No `identifies`: an export is a COPY, and one landing inside the project would claim the id
  // of the document it copied — the listing settles a shared id by path order, and the copy wins.
  const timeline = otioTimelineFor(sequenceOf(useSequences.getState(), documentId), documentId, {
    linkOf: fileUrlsUnder(projectPath),
  })

  const name = documentExportName(useDocuments.getState(), documentId, 'edit')
  return {
    folder: name,
    target: 'montage.otio',
    files: [
      {
        name,
        extension: exportTargetOf('montage.otio').extension,
        bytes: new TextEncoder().encode(serializeSequencePayload(timeline)),
      },
    ],
  }
}

/**
 * The same cut in one of the two plain-text interchanges. Written from the STATE rather than from
 * the OTIO, which would be translating a translation — and the names come from the catalogue,
 * both formats naming their shots.
 */
export async function exportCutAs(
  documentId: string,
  target: 'montage.edl' | 'montage.fcpxml',
): Promise<string | null> {
  const bridge = getBridge()
  if (!bridge) return null

  try {
    const compose =
      target === 'montage.edl'
        ? (await import('@/engines/timeline/edl')).edlOf
        : (await import('@/engines/timeline/fcpxml')).fcpxmlOf

    const byId = assetsById(useAssets.getState())
    const name = documentExportName(useDocuments.getState(), documentId, 'edit')
    const state = sequenceOf(useSequences.getState(), documentId)

    return await bridge.montage.export({
      id: newId(),
      name,
      target,
      content: compose(state, name, assetId => byId.get(assetId)?.name ?? assetId),
    })
  } catch (error) {
    reportFailure('sequence.export', documentId, error)
    return null
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
    if (!encoded) return null

    // No row and no watch: a cut is JSON, and a long one is a few megabytes — it is written
    // before a bar would have drawn once.
    return await bridge.montage.export({
      id: newId(),
      name: folder,
      target: 'montage.otio',
      content: new TextDecoder().decode(encoded.bytes),
    })
  } catch (error) {
    reportFailure('sequence.export', documentId, error)
    return null
  }
}

/**
 * The same cut, with the media it points at packed beside it.
 *
 * The bytes of a rush never cross the bridge: what goes over is the timeline and the LIST of what
 * it names, and the main process reads each file itself — a montage is measured in gigabytes, and
 * the boundary copies whatever crosses it, twice.
 */
export async function exportOtioz(documentId: string): Promise<string | null> {
  const bridge = getBridge()
  if (!bridge) return null

  try {
    const projectPath = useProject.getState().project?.path
    if (!projectPath) throw new Error('no project is open to resolve the media against')

    const bundle = bundleOf(
      otioTimelineFor(sequenceOf(useSequences.getState(), documentId), documentId, {
        linkOf: fileUrlsUnder(projectPath),
      }),
    )
    const name = documentExportName(useDocuments.getState(), documentId, 'edit')

    // The id travels WITH the request: the process that writes the archive answers the stop
    // button by that same name, and one handed back at the end would come minutes too late.
    return await runTask(name, id =>
      bridge.montage.export({
        id,
        name,
        target: 'montage.otioz',
        content: serializeSequencePayload(bundle.timeline),
        media: bundle.media,
      }),
    )
  } catch (error) {
    reportFailure('sequence.export', documentId, error)
    return null
  }
}
