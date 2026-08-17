import { isAbsolute } from 'node:path'
import { z } from 'zod'
import { isBranchName } from '@shared/domain/git'

/**
 * How many files one gesture may name.
 *
 * Bounded because a command line is: git is spawned with these as arguments, and a list long
 * enough overruns the operating system's own limit — which fails as an opaque `E2BIG` rather
 * than as anything a user could read. Well above any selection a hand makes.
 */
const PATHS_MAX = 2000

/**
 * A path inside the project, as git writes them.
 *
 * Relative, slash-joined, and unable to climb out. The renderer is the sandboxed side and these
 * become arguments to a command that writes: an absolute path would send `git restore` at a file
 * outside the project entirely, and `..` would walk it there a segment at a time.
 *
 * A leading dash is refused as well, and it is not a path problem: git would read `-f` as an
 * option rather than as a file. Every command here also passes `--`, so this is the second of
 * two locks on the same door.
 */
const gitPath = z
  .string()
  .min(1)
  .max(1024)
  .refine(value => !isAbsolute(value) && !value.startsWith('/') && !value.startsWith('-'))
  .refine(value => !value.split('/').includes('..'))
  .refine(value => !/\p{Cc}/u.test(value))

const paths = z.array(gitPath).min(1).max(PATHS_MAX)

export function parseGitPaths(value: unknown): string[] {
  return paths.parse(value)
}

export function parseGitPath(value: unknown): string {
  return gitPath.parse(value)
}

/**
 * What a commit is recorded under. Bounded rather than trusted — it reaches git as an argument,
 * and the panel's own field is four lines.
 */
const commitMessage = z.string().trim().min(1).max(20000)

export function parseCommitMessage(value: unknown): string {
  return commitMessage.parse(value)
}

/** Checked here as well as in the panel: the panel is the side that cannot be trusted. */
const branchName = z.string().max(255).refine(isBranchName)

export function parseBranchName(value: unknown): string {
  return branchName.parse(value)
}

/**
 * A commit, named the only way git names one.
 *
 * Hexadecimal and nothing else, which closes the same door `gitPath` closes: the value reaches
 * `git show <hash>` as an argument, and git reads one beginning with `-` as an OPTION.
 * `--upload-pack=…` would then run a command of the caller's choosing.
 */
const commitHash = z
  .string()
  .min(4)
  .max(64)
  .refine(value => /^[0-9a-f]+$/i.test(value))

export function parseCommitHash(value: unknown): string {
  return commitHash.parse(value)
}

/**
 * The same, where nothing is a legitimate answer: a comparison against the working copy names no
 * version. `null` is the only thing accepted beside a hash — `undefined` would let a caller that
 * forgot the argument be read as one that meant the working copy.
 */
export function parseOptionalHash(value: unknown): string | null {
  return value === null ? null : commitHash.parse(value)
}

/**
 * How much of the history to ask for, and how far in.
 *
 * Whole numbers, and bounded on both: they are interpolated into `--max-count=` and `--skip=`,
 * where anything else would be a second argument rather than a number. The ceiling is what one
 * scroll of a band can hold several times over.
 */
const page = z.object({
  limit: z.number().int().min(1).max(500),
  skip: z.number().int().min(0).max(100000),
})

export function parseLogPage(limit: unknown, skip: unknown): { limit: number; skip: number } {
  return page.parse({ limit, skip })
}

/**
 * What a remote is called. `origin` in all but the odd case, and git's own rules for a ref name
 * cover the rest — including the leading dash that would otherwise be read as an option.
 */
const remoteName = z.string().max(100).refine(isBranchName)

export function parseRemoteName(value: unknown): string {
  return remoteName.parse(value)
}

/**
 * Where a remote lives.
 *
 * Two shapes and no others, because a git URL can name a great deal more than a server. `ext::`
 * and `file://` are the two worth naming: the first RUNS A COMMAND the URL contains, and the
 * second turns a clone into a read of any path on the machine. Neither is something anybody
 * types into a version panel, and both are how a pasted string becomes an execution.
 *
 * A leading dash is refused for the reason every argument here refuses one.
 */
const remoteUrl = z
  .string()
  .min(1)
  .max(2048)
  .refine(value => !value.startsWith('-'))
  .refine(value => !/\p{Cc}/u.test(value))
  .refine(value => /^https?:\/\/[^\s]+$/i.test(value) || /^(ssh:\/\/|[\w.-]+@)[^\s]+$/i.test(value))

export function parseRemoteUrl(value: unknown): string {
  return remoteUrl.parse(value)
}

/** The server a token belongs to. A host and nothing else — no scheme, no path, no credentials. */
const host = z
  .string()
  .min(1)
  .max(255)
  .refine(value => /^[a-z0-9.-]+(:\d+)?$/i.test(value))

export function parseHost(value: unknown): string {
  return host.parse(value)
}

/**
 * A username and a token on their way IN.
 *
 * Bounded and stripped of control characters, because both are written into the environment of a
 * child process: a newline in a token would end the line the credential helper echoes and let
 * whatever follows be read as the next field git asks for.
 */
const credential = z.object({
  user: z
    .string()
    .min(1)
    .max(200)
    .refine(value => !/\p{Cc}/u.test(value)),
  token: z
    .string()
    .min(1)
    .max(4096)
    .refine(value => !/\p{Cc}/u.test(value)),
})

export function parseCredential(user: unknown, token: unknown): { user: string; token: string } {
  return credential.parse({ user, token })
}

/**
 * Which pile in the stash stack.
 *
 * A whole number, because it is written into `stash@{n}` — a value that is not one would make
 * that a reference git resolves to something else entirely, or to nothing. The ceiling is far
 * above any stack a person keeps by hand.
 */
const stashIndex = z.number().int().min(0).max(1000)

export function parseStashIndex(value: unknown): number {
  return stashIndex.parse(value)
}
