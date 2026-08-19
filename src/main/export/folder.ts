import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { CapabilityDomain } from '@shared/domain/formatCapability'
import { CHANNELS, type FolderExportRequest } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { folderInsideProject } from '@main/project/folderInsideProject'
import { parseFolderExport } from './validation'

export type ExportHandlerDeps = {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickFolder: () => Promise<string | null>
  /**
   * Where the open project sits, or nothing when none is. Injected rather than read, for the
   * reason above and one more: the store is a module singleton, and a test that wrote into it
   * would decide what every other test in the file sees.
   */
  projectPath: () => string | null
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
  destinationOf: (folder: string) => Promise<string | null>,
  allowed: CapabilityDomain | null,
): Promise<string | null> {
  const { folder, files }: FolderExportRequest = parseFolderExport(request, allowed)

  const destination = await destinationOf(folder)
  if (!destination) return null

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
export function registerExportHandlers({ pickFolder, projectPath }: ExportHandlerDeps): void {
  const picked = async (folder: string): Promise<string | null> => {
    const chosen = await pickFolder()
    return chosen && join(chosen, folder)
  }

  /**
   * The third door, and the only one an outside client can use: the destination is NAMED rather
   * than pointed at, so it is held inside the open project instead of being trusted.
   */
  const inProject = async (folder: string): Promise<string | null> => {
    const root = projectPath()
    return root ? folderInsideProject(root, folder) : null
  }

  // The channel PINS the section, so naming a target is not enough to reach another one's
  // extension: the renderer chooses both the target and the file name, and without this a sky
  // could ask for a `.usdz` on the sky channel and be written one.
  handle(CHANNELS.textureExport, (_event, request) => writeFolder(request, picked, 'material'))
  handle(CHANNELS.skyboxExport, (_event, request) => writeFolder(request, picked, 'sky'))
  // The outside door serves every section, so it pins none — what holds it is the destination,
  // which is NAMED rather than pointed at and stays inside the open project.
  handle(CHANNELS.projectExport, (_event, request) => writeFolder(request, inProject, null))
}
