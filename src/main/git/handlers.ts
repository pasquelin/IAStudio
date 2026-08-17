import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { ProjectStore } from '@main/project/store'
import { gitVersionProbe } from './binary'
import { openRepository } from './repository'
import { createGitService, type GitService } from './service'

export type GitHandlerDeps = {
  /** Only what version control reads: which project is open, if any. */
  project: Pick<ProjectStore, 'current'>
  /** A binary the user named in the preferences, or nothing to take whatever is on the PATH. */
  binaryPath: () => string | undefined
}

/**
 * Wires the version panels to git.
 *
 * The service is answered back rather than kept here, so whoever follows the preferences can tell
 * it to forget a binary that has just changed — the instance holds both the detection and the
 * command queue, and neither survives being rebuilt per call.
 */
export function registerGitHandlers({ project, binaryPath }: GitHandlerDeps): GitService {
  const service = createGitService({
    projectPath: () => project.current()?.path ?? null,
    binaryPath,
    probe: gitVersionProbe,
    open: openRepository,
  })

  handle(CHANNELS.gitRead, () => service.read())
  handle(CHANNELS.gitInit, () => service.init())

  return service
}
