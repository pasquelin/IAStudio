import type { GitChange, GitFailure, GitFile } from '@shared/domain/git'

/**
 * One row of `git status --porcelain`, as simple-git hands it over.
 *
 * Structural rather than imported from the library, and the test is the reason: a shape declared
 * here can be built by hand, so everything below is checked without a repository, a binary, or a
 * temporary folder. `working_dir` wears the library's own spelling — renaming it here would make
 * the two disagree at exactly the point where nothing checks them.
 */
export type PorcelainEntry = {
  path: string
  index: string
  working_dir: string
  /** Where a rename came from. Git only fills it for `R` and `C`. */
  from?: string
}

/**
 * The two-letter codes git uses for a path both sides have touched. Every one of them is a
 * conflict, and none of them means what the same letters mean apart — `AA` is not "added twice",
 * it is "both sides added this".
 */
const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

const CHANGES: Record<string, GitChange> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  // A file that changed KIND — a symlink that became a file. Nothing in the panel treats it
  // apart, and calling it what it is would need a badge for a case a studio project never makes.
  T: 'modified',
}

/**
 * Porcelain rows turned into what the panel draws.
 *
 * One row can produce TWO files, and that is the whole point of the split: `MM` means the file
 * was modified, staged, then modified again — it belongs under both headings, and a panel showing
 * it once would let a commit record a version the user is not looking at.
 */
export function filesOf(entries: readonly PorcelainEntry[]): GitFile[] {
  return entries.flatMap(entry => {
    const code = `${entry.index}${entry.working_dir}`

    if (code === '??') return [file(entry.path, 'untracked', 'untracked')]
    if (CONFLICT_CODES.has(code)) return [file(entry.path, 'conflicted', 'conflicted')]

    const staged = CHANGES[entry.index]
    const unstaged = CHANGES[entry.working_dir]

    return [
      ...(staged ? [file(entry.path, 'staged', staged, entry.from)] : []),
      ...(unstaged ? [file(entry.path, 'unstaged', unstaged, entry.from)] : []),
    ]
  })
}

function file(path: string, stage: GitFile['stage'], change: GitChange, from?: string): GitFile {
  return from === undefined ? { path, stage, change } : { path, stage, change, from }
}

/**
 * Which sentence the panel owes the user for a command that did not answer.
 *
 * Read off git's own words, which is the only thing there is to read — git reports through stderr
 * and an exit code, and the code says nothing but "it failed". The patterns are matched in order
 * of how specific they are: a network failure mentions a host, an authentication failure mentions
 * credentials, and both can carry the word "fatal" that means nothing on its own.
 *
 * Anything unrecognised is `unknown` rather than a guess. The panel shows git's own line for that
 * case, which is more use than a sentence we made up about a failure we did not identify.
 */
export function failureOf(error: unknown): GitFailure {
  const message = messageOf(error)

  if (/not a git repository|does not appear to be a git repository/i.test(message)) {
    return 'not-a-repository'
  }
  if (/index\.lock|unable to create .*\.lock|another git process/i.test(message)) return 'locked'
  if (/enoent|command not found|spawn git|git: not found/i.test(message)) return 'binary-missing'
  // The first commit on a machine where git has never been configured. Common enough to earn a
  // sentence of its own — git's own runs to eight lines and ends in a shell command.
  if (/please tell me who you are|unable to auto-detect email|empty ident name/i.test(message)) {
    return 'no-identity'
  }
  if (
    /authentication failed|could not read username|could not read password|permission denied \(publickey\)|invalid username or password|access denied/i.test(
      message,
    )
  ) {
    return 'authentication'
  }
  if (
    /could not resolve host|network is unreachable|failed to connect|connection timed out|unable to access/i.test(
      message,
    )
  ) {
    return 'network'
  }
  if (/conflict|merge failed|needs merge/i.test(message)) return 'conflict'

  return 'unknown'
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : ''
}

/**
 * Git's own words, with anything that looks like a credential taken out.
 *
 * Shown to the user and written to the journal, and both are why this exists: git echoes the
 * remote URL on failure, and a URL carrying a token — `https://x-access-token:ghp_…@github.com` —
 * would put that token in a log file the studio keeps and the user may well send on.
 */
export function safeMessage(error: unknown): string {
  return messageOf(error).replace(/\/\/[^/@\s]*:[^/@\s]*@/g, '//***@')
}
