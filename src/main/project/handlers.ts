import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { ProjectStore } from './store'
import { parseAssetQuery, parseProjectName, parseProjectPath } from './validation'

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
}
