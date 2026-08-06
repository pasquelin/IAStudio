import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { assetUrl } from '@main/assets/protocol'
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

  // A cloud asset already has a public URL; a local one is served over `scenario://`, and the
  // renderer never learns where the file actually sits.
  handle(CHANNELS.assetsUrl, (_event, assetId) => {
    const asset = project.catalog().find(parseAssetId(assetId))
    if (!asset) return null
    return asset.location === 'local' && asset.path ? assetUrl(asset.id) : null
  })
}
