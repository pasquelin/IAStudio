import type {
  GitChange,
  GitCommit,
  GitCommitFile,
  GitFailure,
  GitFile,
  GitRef,
  GitStashEntry,
} from '@shared/domain/git'
import { messageOf } from '@shared/guards'

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
 * The two separators the log is asked for with, and read back by.
 *
 * ASCII 31 between fields and 30 between commits — outside anything a person types. A newline or
 * a tab would not do: a commit message is written by a human and may hold either, so a format a
 * message can break is a format that breaks the day somebody pastes something in.
 *
 * Built from their code points rather than written as characters, and that is not decoration:
 * both are invisible in an editor, so a literal one is a line nobody can search for, read, or
 * edit without deleting it by accident — for a value the format string and the parser below have
 * to agree on exactly.
 */
const FIELD = String.fromCharCode(31)
const RECORD = String.fromCharCode(30)

/**
 * `%s` is the SUBJECT alone, which keeps a message to one line whatever its body holds. `%D` is
 * the names pointing at the commit, without the brackets `%d` wraps them in.
 */
export const LOG_FORMAT = ['%H', '%P', '%an', '%aI', '%D', '%s'].join(FIELD) + RECORD

export function parseLog(output: string): GitCommit[] {
  return output
    .split(RECORD)
    .map(record => record.trim())
    .filter(record => record !== '')
    .flatMap(record => {
      const [hash, parents, author, at, refs, message] = record.split(FIELD)
      if (hash === undefined || message === undefined) return []

      return [
        {
          hash,
          // The first commit has no parent and writes an empty field, which splits into one
          // empty string rather than into nothing.
          parents: (parents ?? '').split(' ').filter(value => value !== ''),
          author: author ?? '',
          at: at ?? '',
          refs: parseRefs(refs ?? ''),
          message,
        },
      ]
    })
}

/**
 * The names git writes beside a commit: `HEAD -> main, tag: v1.0, origin/main`.
 *
 * `HEAD -> ` is stripped rather than kept as a name of its own — which branch is out is already
 * said by the branch button, and a fourth badge saying it again on one row of the log would be
 * the only row that had it.
 */
export function parseRefs(decoration: string): GitRef[] {
  return decoration
    .split(', ')
    .map(entry => entry.trim())
    .filter(entry => entry !== '')
    .flatMap<GitRef>(entry => {
      if (entry.startsWith('tag: ')) return [{ kind: 'tag', name: entry.slice(5) }]

      const name = entry.replace(/^HEAD -> /, '')
      // `HEAD` alone is a detached head and names nothing a reader can go to.
      if (name === 'HEAD') return []

      // A slash is what tells a remote branch from a local one — `origin/main` against `main`.
      // A local branch may hold one too (`feat/git`), so the first segment is checked against
      // nothing: what matters is that both read as places, and the badge is the same shape.
      return [{ kind: name.includes('/') ? 'remote' : 'branch', name }]
    })
}

/** Git's output, line by line, with the blank one it ends on left out. */
function lines(output: string): string[] {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
}

/**
 * `git stash list` under a format of its own: the place in the stack, then what it says.
 *
 * The index is the LINE's, counted before the empty ones are dropped — it is what `stash pop`
 * and `stash drop` are given, so it has to be the number git itself would use. A pile made
 * outside the studio can have an empty message, and numbering the surviving lines would then
 * throw away the pile below the one that was asked for.
 */
export function parseStashList(output: string): GitStashEntry[] {
  return output
    .split('\n')
    .map((line, index) => ({ index, message: line.trim() }))
    .filter(entry => entry.message !== '')
}

/** What `--name-status` writes: a letter, a tab, a path — and for a rename, two paths. */
export function parseNameStatus(output: string): GitCommitFile[] {
  return lines(output).flatMap(line => {
    const [code, first, second] = line.split('\t')
    // `R096` and `C075` carry their similarity score in the letter's own field.
    const change = CHANGES[(code ?? '').charAt(0)]
    if (change === undefined || first === undefined) return []

    // A rename writes the OLD path first and the new one second, which is the way round a
    // reader wants it: the row is named for where the file is now.
    return second === undefined
      ? [{ path: first, change }]
      : [{ path: second, change, from: first }]
  })
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
export function gitFailureOf(error: unknown): GitFailure {
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
