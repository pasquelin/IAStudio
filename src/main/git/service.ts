import type { GitBinary, GitRepository } from '@shared/domain/git'
import { detectGit, type VersionProbe } from './binary'
import { failureOf, safeMessage } from './parse'
import type { Repository } from './repository'

export type GitServiceDeps = {
  /** The open project's folder, or nothing when none is open. */
  projectPath: () => string | null
  /** A binary the user named in the preferences, or nothing to take whatever is on the PATH. */
  binaryPath: () => string | undefined
  probe: (binary?: string) => VersionProbe
  /** Throws for a binary simple-git will not accept — see `openRepository`. */
  open: (root: string, binary?: string) => Repository
}

export type GitService = {
  /** Everything the panel needs in one answer, including the four states before `ready`. */
  read: () => Promise<GitRepository>
  /** `git init` on the open project, then the state it left. */
  init: () => Promise<GitRepository>
  /** Drops what was detected and held, so a changed preference is read afresh. */
  forget: () => void
}

/**
 * The studio's one way in to git.
 *
 * Two things are held rather than asked for again: whether this machine has git — a spawn per
 * refresh, for an answer that does not change while the app runs — and the port onto the open
 * project, whose simple-git instance carries the queue that keeps commands from colliding.
 * Building a fresh one per call would hand out a fresh queue with it, which is the same as
 * having none.
 */
export function createGitService({
  projectPath,
  binaryPath,
  probe,
  open,
}: GitServiceDeps): GitService {
  let detected: GitBinary | null = null
  let held: { root: string; binary: string | undefined; repository: Repository } | null = null

  const binaryOf = async (): Promise<GitBinary> => {
    detected ??= await detectGit(probe(binaryPath()))
    return detected
  }

  /**
   * The port onto a folder, or nothing when the named binary cannot be used. Rebuilt when either
   * the project or the preference moved — the instance is bound to both.
   */
  const repositoryAt = (root: string): Repository | null => {
    const binary = binaryPath()
    if (held?.root === root && held.binary === binary) return held.repository

    try {
      held = { root, binary, repository: open(root, binary) }
      return held.repository
    } catch {
      held = null
      return null
    }
  }

  /** Either a folder to run git in, or the screen the panel shows instead of one. */
  const reach = async (): Promise<
    { reached: true; repository: Repository } | { reached: false; state: GitRepository }
  > => {
    const root = projectPath()
    if (!root) return { reached: false, state: { kind: 'no-project' } }

    if (!(await binaryOf()).found) return { reached: false, state: { kind: 'no-binary' } }

    const repository = repositoryAt(root)
    return repository
      ? { reached: true, repository }
      : { reached: false, state: { kind: 'no-binary' } }
  }

  const read = async (): Promise<GitRepository> => {
    const found = await reach()
    if (!found.reached) return found.state

    try {
      if (!(await found.repository.isRepository())) return { kind: 'uninitialised' }
      return { kind: 'ready', status: await found.repository.status() }
    } catch (error) {
      return { kind: 'failed', reason: failureOf(error), detail: safeMessage(error) }
    }
  }

  return {
    read,

    init: async () => {
      const found = await reach()
      if (!found.reached) return found.state

      try {
        await found.repository.init()
      } catch (error) {
        return { kind: 'failed', reason: failureOf(error), detail: safeMessage(error) }
      }

      return await read()
    },

    forget: () => {
      detected = null
      held = null
    },
  }
}
