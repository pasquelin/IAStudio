import { join } from 'node:path'
import { CheckRepoActions, simpleGit, type SimpleGit } from 'simple-git'
import { defaultIgnore, type GitStatus } from '@shared/domain/git'
import { exists, writeAtomic } from '@main/persistence'
import { filesOf } from './parse'

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
  }
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
