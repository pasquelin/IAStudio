import { readFile } from 'node:fs/promises'
import { CHANNELS } from '@shared/ipc'
import { assetFilePath } from '@main/assets/protocol'
import { handle } from '@main/ipc/handle'
import { peaksFromBytes } from '@main/media/peaks'
import type { ProjectStore } from './store'
import { parseAssetId, parseAssetQuery, parseProjectName, parseProjectPath } from './validation'

export type ProjectHandlerDeps = {
  project: ProjectStore
  /** Injected rather than imported: `dialog` needs a live app, which no test has. */
  pickFolder: () => Promise<string | null>
}

export function registerProjectHandlers({ project, pickFolder }: ProjectHandlerDeps): void {
  handle(CHANNELS.projectCreate, (_event, path, name) =>
    project.create(parseProjectPath(path), parseProjectName(name)),
  )

  handle(CHANNELS.projectOpen, (_event, path) => project.open(parseProjectPath(path)))

  handle(CHANNELS.projectCurrent, () => project.current())

  handle(CHANNELS.projectPickFolder, () => pickFolder())

  handle(CHANNELS.assetsSearch, (_event, query) => project.catalog().search(parseAssetQuery(query)))

  handle(CHANNELS.assetsPeaks, async (_event, assetId) => {
    const asset = project.catalog().find(parseAssetId(assetId))
    if (!asset?.peaksPath) return null

    // Through the same resolver the scheme uses: a stored path is user-editable territory.
    const file = assetFilePath(project.path(), asset.peaksPath)
    if (!file) return null

    try {
      return peaksFromBytes(await readFile(file))
    } catch {
      // A project folder can be moved or pruned under us; a clip without its waveform still
      // paints as a rectangle.
      return null
    }
  })
}
