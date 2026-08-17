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
