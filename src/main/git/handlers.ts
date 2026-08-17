import { CHANNELS } from '@shared/ipc'
import type { GitIdentity } from '@shared/domain/git'
import { handle } from '@main/ipc/handle'
import type { ProjectStore } from '@main/project/store'
import { gitVersionProbe } from './binary'
import { openRepository } from './repository'
import { createGitService, type GitService } from './service'
import { parseBranchName, parseCommitMessage, parseGitPaths } from './validation'

export type GitHandlerDeps = {
  /** Only what version control reads: which project is open, if any. */
  project: Pick<ProjectStore, 'current'>
  /** A binary the user named in the preferences, or nothing to take whatever is on the PATH. */
  binaryPath: () => string | undefined
  /** Who to record a commit under, or nothing to leave git reading its own configuration. */
  identity: () => GitIdentity | undefined
}

/**
 * Wires the version panels to git.
 *
 * The service is answered back rather than kept here, so whoever follows the preferences can tell
 * it to forget a binary that has just changed — the instance holds both the detection and the
 * command queue, and neither survives being rebuilt per call.
 *
 * Every argument is parsed before it reaches a command. These are paths and names that become
 * arguments to a process that WRITES, and the renderer is the sandboxed side.
 */
export function registerGitHandlers({ project, binaryPath, identity }: GitHandlerDeps): GitService {
  const service = createGitService({
    projectPath: () => project.current()?.path ?? null,
    binaryPath,
    identity,
    probe: gitVersionProbe,
    open: openRepository,
  })

  handle(CHANNELS.gitRead, () => service.read())
  handle(CHANNELS.gitInit, () => service.init())
  handle(CHANNELS.gitStage, (_event, paths) => service.stage(parseGitPaths(paths)))
  handle(CHANNELS.gitUnstage, (_event, paths) => service.unstage(parseGitPaths(paths)))
  handle(CHANNELS.gitRestore, (_event, paths) => service.restore(parseGitPaths(paths)))
  handle(CHANNELS.gitCommit, (_event, message, amend) =>
    service.commit(parseCommitMessage(message), amend === true),
  )
  handle(CHANNELS.gitBranches, () => service.branches())
  handle(CHANNELS.gitCreateBranch, (_event, name) => service.createBranch(parseBranchName(name)))
  handle(CHANNELS.gitCheckout, (_event, name) => service.checkout(parseBranchName(name)))

  return service
}
