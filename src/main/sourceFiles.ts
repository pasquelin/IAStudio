/**
 * How a guard of the MAIN process reads the project's sources rather than importing them.
 *
 * The AST guards that sweep the whole repository from this side need the same three things: the
 * walk, the four trees, and a timeout wide enough for them. Held here so a guard added later
 * inherits the same reading, and so the exclusion below is decided once. The window's guards have
 * no filesystem and borrow `renderer/src/window-sources.ts` instead — same idea, other mechanism.
 *
 * `wideGuards.ts` is the other half of this and NOT the same job: it detects which suites read
 * the tree, so the short loop replays them. It never hands one the files. A guard importing this
 * module still has to read something itself for `readsTheTree` to recognise it — both callers do,
 * through `readFileSync` anchored on `import.meta.url`.
 */
import { readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Long enough for four trees of sources, parsed one file at a time. */
export const WHOLE_PROJECT = 60_000

/**
 * Test material is out, `-fixtures.ts` included: a fixture builds the data a suite asserts on and
 * never reaches a screen, so a job it names `Flux` is the label the API returns, not a word this
 * studio writes. The exclusion is a DECISION, taken 11/08 — a fixture forced through a bundle key
 * says nothing truer and reads worse.
 *
 * `.tsx` as well as `.ts`: the sweep was widened to components, and a fixture is a fixture on
 * either side.
 */
export function sourceFiles(directory: string, into: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) sourceFiles(path, into)
    else if (/\.tsx?$/.test(path) && !/(\.(test|bench)|-fixtures)\.tsx?$/.test(path))
      into.push(path)
  }

  return into
}

/** Where this module sits, which is `src/main` — the anchor the four trees are named from. */
const MAIN = dirname(fileURLToPath(import.meta.url))

/** `src/`, so a finding can be reported as the path a reader would open. */
export const SOURCE_ROOT = join(MAIN, '..')

/**
 * The four trees, `main` first.
 *
 * Four and not three: `main` writes its screens through `TRANSLATIONS` and sorts what its own
 * handlers return, so a defect bound in a module there reaches a reader exactly as one bound in
 * the window does. A guard that wants three of them can take the tail.
 */
export const PROJECT_TREES: readonly string[] = [
  MAIN,
  ...['renderer', 'shared', 'preload'].map(tree => join(SOURCE_ROOT, tree)),
]
