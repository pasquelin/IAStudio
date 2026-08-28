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
 * The floor `scripts/check.mjs` refuses to run below. A detector that recognises nothing prints
 * the same green as one that works, and every hardcoded word would sail through it.
 *
 * Under the real count rather than on it — a suite legitimately deleted must not fail this — but
 * close enough to mean something: it sat at 20 while the count reached 58, where a silent loss of
 * thirty-eight guards would have passed. Never RAISE it to the count; `MOST_SLACK` below is what
 * now says when it has drifted too far, so this no longer rests on anyone remembering.
 *
 * Raised to 81 on 2026-08-28, against 91 read: `no-loose-window-button.test.ts` took the gap to
 * eleven, which is the suite asking for this line rather than anyone remembering to write it.
 */
export const LEAST_GUARDS = 81

/**
 * How far the floor may sit below the real count before it stops meaning anything.
 *
 * A floor only drifts one way — guards are added, it is not — and nothing said so: it reached
 * seventeen below on 2026-08-19, back where a silent loss of seventeen guards would have passed.
 * `wideGuards.test.ts` fails when the gap grows past this, which turns « remember to raise it »
 * into « the suite tells you to ». **Raise the FLOOR when that happens, never this.**
 */
export const MOST_SLACK = 10

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
 * A suite that borrows a sweep instead of writing one — `sourceFiles.ts` for the main process,
 * `renderer/src/windowSources.ts` for the window, a collector under `scripts/` for either.
 * Extracting shared reading MUST come with a line here, or the borrower leaves the short loop in
 * silence. A count that rises says a rule caught something, never that it caught everything: the
 * qualified spelling alone once missed the five consumers sitting beside the module.
 */
function borrowsTheSweep(code: string): boolean {
  // Any depth of `../`, not just the sibling: a guard one folder down imports `'../sourceFiles'`
  // and would have dropped out of the net exactly like the one this function was added for. The
  // review caught the two literal spellings before anyone wrote that guard.
  //
  // `(design/)?` is the third spelling, and it cost a day: the five guards that SIT BESIDE
  // `testHarness.ts` write `'./testHarness'`, which the folder-qualified form does not match.
  // The line added for it on 2026-08-16 caught its five distant consumers and none of its
  // neighbours — a fix measured by a count that went up, which is exactly how a half-fix looks.
  return /from '\.[./]*\/(sourceFiles|windowSources|(design\/)?testHarness)'|from '@main\/sourceFiles'|from '@\/(windowSources|design\/testHarness)'|from '\.[./]*\/scripts\/[\w-]+\.ts'/.test(
    code,
  )
}

/**
 * A suite that asks GIT for the tree instead of reading it — `git grep`, `git ls-files`.
 *
 * The sixth way, and it was missing for a day: a guard sweeping every TRACKED file goes through
 * neither `fs` nor a glob, so all five other detectors were blind to it while it was the only
 * thing standing between the repository and a defect it had just spent a lot removing.
 */
const asksGitForTheTree = (code: string): boolean => /execFileSync\(\s*'git'/.test(code)

/**
 * Whether a test reads sources it never imports.
 *
 * Six ways. The fourth was missing until a review found it on 2026-08-13: a wide
 * `import.meta.glob`, a walk of the disk, a read of a file that is data rather than a module
 * (`vitest.config.ts` for the test projects, `index.css` for the design tokens), and a read
 * anchored on the suite's own location. That last one covers `csp.test.ts`, `licences.test.ts`,
 * `permission-strings.test.ts` and `gate-caches.test.ts` — four guards that sat outside the net
 * while the floor read 32 and looked healthy. The fifth arrived with `sourceFiles.ts`, for the
 * suites that no longer read anything themselves; the sixth with the first guard to ask git. A
 * count above `LEAST_GUARDS` proves nothing about what the detector cannot see, which is why the
 * ways are enumerated here rather than counted.
 */
export function readsTheTree(code: string): boolean {
  return (
    walksTheTree(code) ||
    readsAnchoredFile(code) ||
    borrowsTheSweep(code) ||
    asksGitForTheTree(code) ||
    /readdirSync|vitest\.config\.ts|index\.css/.test(code)
  )
}

/**
 * Every suite under `folder`, whatever it reads — or whatever else `matching` asks for.
 *
 * Exported because a guard that sweeps the SUITES rather than the sources has nowhere else to get
 * them: `sourceFiles.ts` excludes `.test.ts` by design. Two walks of the same tree would drift,
 * which is what the pattern is for: `file-names.test.ts` wants the BENCHES, and had written the
 * same recursion out a second time to get them.
 */
export function testFilesUnder(folder: string, matching = /\.test\.tsx?$/): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return testFilesUnder(path, matching)
    return matching.test(entry.name) ? [path] : []
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
