import type {
  GitBinary,
  GitBranch,
  GitCommit,
  GitCommitFile,
  GitIdentity,
  GitRepository,
} from '@shared/domain/git'
import { remoteHost, type GitRemote, type GitStashEntry } from '@shared/domain/git'
import type { GitDiff } from '@shared/domain/gitDiff'
import { detectGit, type VersionProbe } from './binary'
import type { CredentialVault } from './credentials'
import { failureOf, safeMessage } from './parse'
import type { Repository, RepositoryDeps } from './repository'

export type GitServiceDeps = {
  /** Tokens for the servers this studio pushes to. Read here, never past the boundary. */
  vault: CredentialVault
  /** The open project's folder, or nothing when none is open. */
  projectPath: () => string | null
  /** A binary the user named in the preferences, or nothing to take whatever is on the PATH. */
  binaryPath: () => string | undefined
  /** Who to record a commit under, or nothing to leave git reading its own configuration. */
  identity: () => GitIdentity | undefined
  probe: (binary?: string) => VersionProbe
  /** Throws for a binary simple-git will not accept — see `openRepository`. */
  open: (root: string, binary: string | undefined, deps: RepositoryDeps) => Repository
}

export type GitService = {
  /** Everything the panel needs in one answer, including the four states before `ready`. */
  read: () => Promise<GitRepository>
  init: () => Promise<GitRepository>
  stage: (paths: readonly string[]) => Promise<GitRepository>
  unstage: (paths: readonly string[]) => Promise<GitRepository>
  restore: (paths: readonly string[]) => Promise<GitRepository>
  commit: (message: string, amend: boolean) => Promise<GitRepository>
  /** Empty where git could not answer: a menu with no rows says the same thing as a failure. */
  branches: () => Promise<GitBranch[]>
  createBranch: (name: string) => Promise<GitRepository>
  checkout: (name: string) => Promise<GitRepository>
  /** A page of the history, newest first. Empty where there is none, and where git refused. */
  log: (limit: number, skip: number) => Promise<GitCommit[]>
  commitFiles: (hash: string) => Promise<GitCommitFile[]>
  /** What changed in one file. `empty` covers both "nothing" and "git could not say". */
  diff: (path: string, commit: string | null) => Promise<GitDiff>
  bytes: (path: string, ref: string | null) => Promise<Uint8Array | null>
  remotes: () => Promise<GitRemote[]>
  addRemote: (name: string, url: string) => Promise<GitRepository>
  removeRemote: (name: string) => Promise<GitRepository>
  fetch: () => Promise<GitRepository>
  pull: () => Promise<GitRepository>
  push: (setUpstream: boolean) => Promise<GitRepository>
  resolve: (paths: readonly string[], side: 'ours' | 'theirs') => Promise<GitRepository>
  abortMerge: () => Promise<GitRepository>
  stash: (message: string) => Promise<GitRepository>
  stashes: () => Promise<GitStashEntry[]>
  stashPop: (index: number) => Promise<GitRepository>
  stashDrop: (index: number) => Promise<GitRepository>
  tags: () => Promise<string[]>
  tag: (name: string, commit: string) => Promise<GitRepository>
  deleteTag: (name: string) => Promise<GitRepository>
  /** Whether a token is held for the host a URL lives on. Never the token. */
  hasCredentials: (host: string) => boolean
  setCredentials: (host: string, user: string, token: string) => void
  clearCredentials: (host: string) => void
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
 *
 * Every gesture answers with the state it LEFT rather than with nothing. One round trip instead
 * of two, and — the part that matters — no window between the command and the refresh in which
 * two panels could draw a repository that is already out of date.
 */
export function createGitService({
  vault,
  projectPath,
  binaryPath,
  identity,
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
      held = {
        root,
        binary,
        repository: open(root, binary, {
          // An SSH remote has no host as far as a token goes, and answers nothing: its
          // credentials are the machine's own key and agent, which the studio does not hold.
          credentials: url => {
            const host = remoteHost(url)
            return host === null ? null : vault.read(host)
          },
        }),
      }
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

  /** Runs one gesture and answers with the state it left, or with why it did not happen. */
  const perform = async (
    run: (repository: Repository) => Promise<void>,
  ): Promise<GitRepository> => {
    const found = await reach()
    if (!found.reached) return found.state

    try {
      await run(found.repository)
    } catch (error) {
      return { kind: 'failed', reason: failureOf(error), detail: safeMessage(error) }
    }

    return await read()
  }

  /** Runs one read and answers with nothing where git could not — see the three callers below. */
  const data = async <T>(run: (repository: Repository) => Promise<T[]>): Promise<T[]> => {
    const found = await reach()
    if (!found.reached) return []

    try {
      return await run(found.repository)
    } catch {
      return []
    }
  }

  return {
    read,

    init: () => perform(repository => repository.init()),
    stage: paths => perform(repository => repository.stage(paths)),
    unstage: paths => perform(repository => repository.unstage(paths)),
    restore: paths => perform(repository => repository.restore(paths)),
    commit: (message, amend) =>
      perform(repository => repository.commit(message, amend, identity())),
    createBranch: name => perform(repository => repository.createBranch(name)),
    checkout: name => perform(repository => repository.checkout(name)),
    addRemote: (name, url) => perform(repository => repository.addRemote(name, url)),
    removeRemote: name => perform(repository => repository.removeRemote(name)),
    fetch: () => perform(repository => repository.fetch()),
    pull: () => perform(repository => repository.pull()),
    push: setUpstream => perform(repository => repository.push(setUpstream)),
    resolve: (paths, side) => perform(repository => repository.resolve(paths, side)),
    abortMerge: () => perform(repository => repository.abortMerge()),
    stash: message => perform(repository => repository.stash(message)),
    stashPop: index => perform(repository => repository.stashPop(index)),
    stashDrop: index => perform(repository => repository.stashDrop(index)),
    tag: (name, commit) => perform(repository => repository.tag(name, commit)),
    deleteTag: name => perform(repository => repository.deleteTag(name)),

    hasCredentials: host => vault.has(host),
    setCredentials: (host, user, token) => vault.set(host, { user, token }),
    clearCredentials: host => vault.clear(host),

    /**
     * The three reads that answer with DATA rather than with a state.
     *
     * Empty on failure, and it is the honest answer for all three: a repository with no first
     * commit has no history, and one whose `git log` refused has none the panel can draw. The
     * screen that says WHY is the Git panel's, which is looking at the same folder — saying it
     * twice, in two panels, over one folder, would be saying it twice.
     */
    branches: () => data(repository => repository.branches()),
    remotes: () => data(repository => repository.remotes()),
    stashes: () => data(repository => repository.stashes()),
    tags: () => data(repository => repository.tags()),
    log: (limit, skip) => data(repository => repository.log(limit, skip)),
    commitFiles: hash => data(repository => repository.commitFiles(hash)),

    diff: async (path, commit) => {
      const found = await reach()
      if (!found.reached) return { kind: 'empty' }

      try {
        return await found.repository.diff(path, commit)
      } catch {
        // A file the version does not hold, a path git will not read: nothing to compare, which
        // is what `empty` says. The Git panel carries the screen that explains a broken folder.
        return { kind: 'empty' }
      }
    },

    bytes: async (path, ref) => {
      const found = await reach()
      return found.reached ? await found.repository.bytes(path, ref) : null
    },

    forget: () => {
      detected = null
      held = null
    },
  }
}
