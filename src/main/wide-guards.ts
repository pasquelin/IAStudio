/**
 * Which tests no import graph can reach, and so which ones the short loop must always replay.
 *
 * `vitest related` walks imports. A handful of suites do not import what they check — they read
 * the tree, through `import.meta.glob` with `?raw` or through `fs` — so nothing connects them to
 * the file they would have caught. Measured on 2026-08-13: hardcoding a word into `Tree.tsx`
 * selects eight test files, all green, while `no-hardcoded-text` sits outside the selection.
 *
 * Detected rather than listed, and that is the whole point: a list would keep passing the day a
 * guard is added, covering one file fewer without a word. The net is deliberately wide — a suite
 * caught for a `readdirSync` over a temporary folder costs the second it takes to run.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The floor `scripts/check.mjs` refuses to run below.
 *
 * A detector that recognises nothing prints the same green as one that works, and every hardcoded
 * word would sail through it — the failure this whole module exists to prevent, and the same
 * reasoning as `LEAST_BUDGETS` in `coverage-budgets.ts`.
 *
 * Measured at 29 on 2026-08-13. Set well under it: guards come and go, and a floor tracking the
 * count exactly would fail for a suite legitimately deleted.
 */
export const LEAST_GUARDS = 20

/**
 * A glob standing for files it does not name, rather than one naming a single file.
 *
 * Any wildcard, not just `**`. A review caught the narrow reading on 2026-08-13: `SettingLine`
 * reads `./*.tsx` and `property-line` reads `./*Field.tsx`, both through `?raw`, and both sat
 * outside the net while being exactly what it is for. A pattern with no `*` at all — `'./Row.tsx'`
 * — names its file, so an import graph already reaches it.
 */
function walksTheTree(code: string): boolean {
  const globs = [...code.matchAll(/import\.meta\.glob<?[^(]*\(\s*(\[[^\]]*\]|'[^']*')/g)]
  // `?? ''`: the group is filled whenever the pattern matched, which `noUncheckedIndexedAccess`
  // cannot know.
  return globs.some(match => (match[1] ?? '').includes('*'))
}

/**
 * A test that reads a file whose path it works out from its own position.
 *
 * `import.meta.dirname` and `import.meta.url` are how a suite reaches the repository rather than
 * a temporary folder — a fixture reads from `mkdtemp`, never from where its own source sits. That
 * makes this narrow on purpose: it added exactly the four below and nothing else.
 */
function readsAnchoredFile(code: string): boolean {
  return /readFileSync|readdirSync/.test(code) && /import\.meta\.(dirname|url)/.test(code)
}

/**
 * A suite that borrows the sweep instead of writing one.
 *
 * `source-files.ts` holds the walk, the four trees and their timeout, so a guard importing it has
 * no `readdirSync` and no `import.meta.url` of its own left to recognise. Measured the day the
 * module was extracted: the detector found 36 guards and `no-bare-locale-compare.test.ts` was not
 * among them — a guard silently outside the short loop, which is the exact failure the four ways
 * below exist to prevent. Extracting shared reading is a good move that MUST come with this line.
 */
function borrowsTheSweep(code: string): boolean {
  // Any depth of `../`, not just the sibling: a guard one folder down imports `'../source-files'`
  // and would have dropped out of the net exactly like the one this function was added for. The
  // review caught the two literal spellings before anyone wrote that guard.
  return /from '\.[./]*\/source-files'|from '@main\/source-files'/.test(code)
}

/**
 * Whether a test reads sources it never imports.
 *
 * Five ways. The fourth was missing until a review found it on 2026-08-13: a wide
 * `import.meta.glob`, a walk of the disk, a read of a file that is data rather than a module
 * (`vitest.config.ts` for the coverage budgets, `index.css` for the design tokens), and a read
 * anchored on the suite's own location. That last one covers `csp.test.ts`, `licences.test.ts`,
 * `permission-strings.test.ts` and `gate-caches.test.ts` — four guards that sat outside the net
 * while the floor read 32 and looked healthy. The fifth arrived with `source-files.ts`, for the
 * suites that no longer read anything themselves. A count above `LEAST_GUARDS` proves nothing
 * about what the detector cannot see, which is why the ways are enumerated here rather than
 * counted.
 */
export function readsTheTree(code: string): boolean {
  return (
    walksTheTree(code) ||
    readsAnchoredFile(code) ||
    borrowsTheSweep(code) ||
    /readdirSync|vitest\.config\.ts|index\.css/.test(code)
  )
}

function testFilesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return testFilesUnder(path)
    return /\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/**
 * Every test under `folder` that reads the tree, walked from disk rather than asked of git.
 *
 * A guard written minutes ago and not yet staged is exactly the one a short loop must not drop in
 * silence: measured on 2026-08-13, `git ls-files` answered 572 test files where the disk held 573,
 * and the missing one was a guard.
 *
 * Here rather than in the script, so the run and the test that guards it count the same set —
 * two walks would drift, and the drift would show as a floor that passes while the loop skips.
 */
export function wideGuardsUnder(folder: string): string[] {
  return testFilesUnder(folder).filter(path => readsTheTree(readFileSync(path, 'utf8')))
}
