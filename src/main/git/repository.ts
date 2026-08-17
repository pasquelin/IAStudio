import { join } from 'node:path'
import { CheckRepoActions, simpleGit, type SimpleGit } from 'simple-git'
import {
  defaultIgnore,
  type GitBranch,
  type GitCommit,
  type GitCommitFile,
  type GitIdentity,
  type GitStatus,
} from '@shared/domain/git'
import { exists, writeAtomic } from '@main/persistence'
import { filesOf, LOG_FORMAT, parseLog, parseNameStatus } from './parse'

export const GITIGNORE_FILE = '.gitignore'

/**
 * One project folder, as the version panels speak to it.
 *
 * A port rather than the library: everything above this line works in the studio's own shapes,
 * and the one place that knows simple-git exists is here. That is what lets `parse.ts` — where
 * every decision actually lives — be checked without a repository on disk.
 */
export type Repository = {
  root: string
  isRepository: () => Promise<boolean>
  init: () => Promise<void>
  status: () => Promise<GitStatus>
  stage: (paths: readonly string[]) => Promise<void>
  unstage: (paths: readonly string[]) => Promise<void>
  /** Puts files back the way HEAD has them, index and worktree alike. */
  restore: (paths: readonly string[]) => Promise<void>
  commit: (message: string, amend: boolean, identity?: GitIdentity) => Promise<void>
  branches: () => Promise<GitBranch[]>
  createBranch: (name: string) => Promise<void>
  checkout: (name: string) => Promise<void>
  /** A page of the history, newest first. `skip` is how many the caller already holds. */
  log: (limit: number, skip: number) => Promise<GitCommit[]>
  /** What one recorded version changed. */
  commitFiles: (hash: string) => Promise<GitCommitFile[]>
}

/**
 * Builds the port. THROWS when the binary named cannot be used — simple-git validates a custom
 * binary as the instance is built, and refuses any path holding a character outside its own list.
 * The caller turns that into the ordinary "no git" answer.
 */
export function openRepository(root: string, binary?: string): Repository {
  const git = simpleGit({
    baseDir: root,
    /**
     * One git at a time, per project. Git takes `.git/index.lock` for the duration of any command
     * that writes, and a second one arriving meanwhile dies rather than waiting — two windows
     * refreshing together is enough to produce it. simple-git's own scheduler queues in order,
     * which is why the studio does not carry a second queue of its own.
     */
    maxConcurrentProcesses: 1,
    ...(binary === undefined ? {} : { binary }),
  })

  return {
    root,
    isRepository: () => isRepositoryRoot(git),
    init: () => initialise(git, root),
    status: () => statusOf(git),
    stage: async paths => {
      await git.add([...paths])
    },
    unstage: paths => unstage(git, paths),
    restore: async paths => {
      // `--source=HEAD` on both sides, so one gesture puts a file back whichever half it was
      // changed in — a file staged AND edited again would otherwise need the button twice.
      await git.raw(['restore', '--source=HEAD', '--staged', '--worktree', '--', ...paths])
    },
    commit: (message, amend, identity) => commit(git, message, amend, identity),
    branches: async () => {
      const summary = await git.branchLocal()
      return summary.all.map(name => ({ name, current: name === summary.current }))
    },
    createBranch: async name => {
      await git.checkoutLocalBranch(name)
    },
    checkout: async name => {
      await git.checkout(name)
    },

    /**
     * `--all` rather than the branch that is out: a version panel that hid the branch one is
     * about to switch to would be hiding the reason for switching. It is also what makes the
     * graph a graph — a single branch has nothing to draw.
     *
     * `--topo-order` rather than by date, and the layout below depends on it: a child must be
     * reached before its parents, and clocks on two machines do not guarantee that.
     */
    log: async (limit, skip) =>
      parseLog(
        await git.raw([
          'log',
          '--all',
          '--topo-order',
          `--max-count=${limit}`,
          `--skip=${skip}`,
          `--format=${LOG_FORMAT}`,
        ]),
      ),

    // `--format=` empties the header, leaving only the file list. `-m --first-parent` makes a
    // merge show what it actually brought in rather than nothing at all, which is what a plain
    // `show` writes for one.
    commitFiles: async hash =>
      parseNameStatus(
        await git.raw(['show', '--name-status', '--format=', '-m', '--first-parent', hash]),
      ),
  }
}

/**
 * Takes files back out of the index.
 *
 * Two commands for one gesture, and which one applies is decided by whether there is a first
 * commit yet. `git reset` resolves HEAD, so on a repository that has none — exactly the state
 * `git init` leaves, and exactly where a user first ticks something by mistake — it fails with a
 * message about an ambiguous argument. `git rm --cached` is the answer there, and only there: on
 * a repository with a history it would stage a DELETION of a file the user only wanted to untick.
 */
async function unstage(git: SimpleGit, paths: readonly string[]): Promise<void> {
  if ((await headOf(git)) === null) await git.raw(['rm', '--cached', '--', ...paths])
  else await git.reset(['--', ...paths])
}

/**
 * Records a version.
 *
 * The identity is passed per command rather than configured on the instance, because it is a
 * preference the user can change between two commits — and because leaving it out is the normal
 * case: git then reads the `user.name` this machine already has, which is the right answer for
 * anyone who already uses git and the wrong one to overwrite.
 */
async function commit(
  git: SimpleGit,
  message: string,
  amend: boolean,
  identity?: GitIdentity,
): Promise<void> {
  await git.raw([
    ...(identity ? ['-c', `user.name=${identity.name}`, '-c', `user.email=${identity.email}`] : []),
    'commit',
    '-m',
    message,
    ...(amend ? ['--amend'] : []),
  ])
}

/**
 * Whether the project folder is the ROOT of a repository, rather than merely inside one.
 *
 * The distinction decides which folder every command lands on. A project sitting somewhere under
 * an unrelated repository — a home directory somebody versioned once — would otherwise have its
 * panel show that repository's thousands of files, and its first commit would write into it.
 */
async function isRepositoryRoot(git: SimpleGit): Promise<boolean> {
  try {
    return await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT)
  } catch {
    // Not a repository is not a failure worth a screen of its own: it is the answer.
    return false
  }
}

/**
 * `git init`, plus the ignore file the studio owes a project.
 *
 * The branch name is left to git, which reads the user's own `init.defaultBranch`. Forcing `main`
 * would quietly overrule a setting somebody chose, and the panel shows whatever name comes back.
 *
 * An ignore file already there is left ALONE. A project being brought under version control for
 * the second time — or one cloned from elsewhere — has rules somebody wrote, and overwriting
 * them to add one line is not a trade the studio gets to make.
 */
async function initialise(git: SimpleGit, root: string): Promise<void> {
  await git.init()

  const file = join(root, GITIGNORE_FILE)
  if (!(await exists(file))) await writeAtomic(file, defaultIgnore())
}

async function statusOf(git: SimpleGit): Promise<GitStatus> {
  const status = await git.status()

  return {
    // A detached HEAD has no branch to name, and `current` still answers the last one it was on.
    branch: status.detached ? null : status.current,
    head: await headOf(git),
    upstream: status.tracking,
    ahead: status.ahead,
    behind: status.behind,
    files: filesOf(status.files),
  }
}

/**
 * The short hash HEAD points at, or nothing before the first commit.
 *
 * A repository with no commit is an ordinary state — it is what `git init` leaves — and
 * `rev-parse` fails there rather than answering empty. Catching is how that state reaches the
 * panel as a screen rather than as an error.
 */
async function headOf(git: SimpleGit): Promise<string | null> {
  try {
    return (await git.revparse(['--short', 'HEAD'])).trim()
  } catch {
    return null
  }
}
