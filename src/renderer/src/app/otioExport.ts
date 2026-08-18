import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { OTIO_EXTENSION } from '@shared/domain/otio'
import type { FolderExportRequest } from '@shared/ipc'
import { otioTimelineOf, type OtioSource } from '@/engines/timeline/otioTimeline'
import type { Clip } from '@/engines/timeline/timelineState'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { documentExportName, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { sequenceOf, useSequences } from '@/stores/sequences'

/**
 * An absolute path as a URL another application resolves.
 *
 * Absolute because one encoding serves two doors that land the file in different places — a save
 * dialog anywhere on the disk, or a folder of the project — and only an absolute link resolves
 * from both. The cost is that moving the project breaks it, which no encoding avoids.
 */
function fileUrlOf(projectPath: string, relative: string): string {
  const joined = `${projectPath.replaceAll('\\', '/').replace(/\/$/, '')}/${relative}`
  const url = new URL('file:///')
  // Through the parser rather than `encodeURIComponent`, which escapes the `:` of a Windows
  // drive letter too. The leading slash is what keeps that letter out of the host.
  url.pathname = joined.startsWith('/') ? joined : `/${joined}`
  return url.href
}

/** Everything a clip is named and pointed at from, read once for a whole montage. */
type Catalogue = {
  projectPath: string
  assets: ReadonlyMap<string, Asset>
  documents: Record<string, DocumentDescriptor>
}

function sourceOf(clip: Clip, { projectPath, assets, documents }: Catalogue): OtioSource {
  if (clip.sceneId) {
    // No url whatever we answer — a scene is rendered, not read — but the NAME is what another
    // application shows in place of the missing picture.
    return { name: documents[clip.sceneId]?.title ?? clip.sceneId, url: null }
  }

  const asset = assets.get(clip.assetId)
  return {
    name: asset?.name ?? clip.assetId,
    url: asset?.path ? fileUrlOf(projectPath, asset.path) : null,
  }
}

/**
 * The montage, encoded to one file — the half of an export that has nothing to do with where it
 * lands. Shared by the File menu and by the outside door, exactly as a scene's is.
 *
 * Composed by the WINDOW: only this side holds the catalogue a clip's media is resolved against,
 * and the main process would have nothing to turn an asset id into a path with.
 *
 * A folder for a single file, like every other door onto the folder writer. Throws when no
 * project is open — there is then no path to point a clip's media at.
 */
export function otioExportFiles(documentId: string): FolderExportRequest {
  const projectPath = useProject.getState().project?.path
  if (!projectPath) throw new Error('no project is open to resolve the media against')

  const tabs = useDocuments.getState()
  const catalogue: Catalogue = {
    projectPath,
    documents: tabs.documents,
    assets: assetsById(useAssets.getState()),
  }
  // The RAW title, which names the timeline inside the file — that is not a file name, and the
  // two are read apart: one by another editing application, the other by a file system.
  const timeline = otioTimelineOf(sequenceOf(useSequences.getState(), documentId), {
    name: tabs.documents[documentId]?.title ?? documentId,
    sourceOf: clip => sourceOf(clip, catalogue),
  })

  const name = documentExportName(tabs, documentId, 'edit')
  return {
    folder: name,
    files: [
      {
        name,
        extension: OTIO_EXTENSION,
        bytes: new TextEncoder().encode(JSON.stringify(timeline, null, 2)),
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
