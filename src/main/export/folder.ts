import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { CHANNELS, type FolderExportRequest } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parseFolderExport } from './validation'

export type ExportHandlerDeps = {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickFolder: () => Promise<string | null>
}

/**
 * Writing an export to disk. A folder rather than a file, and one of its own inside the folder
 * that was picked: the files of an export mean nothing apart — a base colour without the ORM
 * beside it is half a material, five faces of a sky are not a sky — and dropping eight of them
 * loose into somebody's Documents is how an export becomes a cleanup.
 *
 * The renderer has no `fs` and never learns where they landed, exactly as for a scene.
 */
async function writeFolder(
  request: unknown,
  pickFolder: ExportHandlerDeps['pickFolder'],
): Promise<string | null> {
  const { folder, files }: FolderExportRequest = parseFolderExport(request)

  const chosen = await pickFolder()
  if (!chosen) return null

  const destination = join(chosen, folder)
  // `recursive`, so exporting the same subject twice overwrites its folder rather than failing
  // on the second — which is what re-exporting after a change means.
  await mkdir(destination, { recursive: true })

  // One after another: they land in the same folder, and a partial failure that had written
  // half of them in parallel would leave a folder nobody can tell from a finished one.
  for (const file of files) {
    await writeFile(join(destination, `${file.name}${file.extension}`), file.bytes)
  }

  // The name, never the path: where a folder sits is this side's business.
  return basename(destination)
}

/**
 * Two doors onto one writer.
 *
 * Two channels rather than one shared under a name that would fit neither: a texture and a sky
 * are asked for from different places and are refused for different reasons, and a channel
 * called `texture:export` carrying six faces of sky is a line nobody would grep for. What they
 * do once past the boundary is the same thing, and it is written once.
 */
export function registerExportHandlers({ pickFolder }: ExportHandlerDeps): void {
  handle(CHANNELS.textureExport, (_event, request) => writeFolder(request, pickFolder))
  handle(CHANNELS.skyboxExport, (_event, request) => writeFolder(request, pickFolder))
}
