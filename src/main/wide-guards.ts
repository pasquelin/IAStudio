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
 * word would sail through it — the failure this whole module exists to prevent.
 *
 * Measured at 29 on 2026-08-13, then at 42 the same day — the figure moves with every guard
 * added, which is exactly why the floor does not follow it. Set well under: guards come and go,
 * and a floor tracking the count exactly would fail for a suite legitimately deleted.
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
 * A suite that borrows a sweep instead of writing one.
 *
 * TWO modules hold one, one per side of the wall. `source-files.ts` walks the disk for the guards
 * of the main process; `renderer/src/window-sources.ts` holds the `import.meta.glob` for those of
 * the window, which have no filesystem to walk. Either way the borrower is left with no
 * `readdirSync`, no `import.meta.url` and no glob of its own to recognise.
 *
 * A third family joined them: a **collector under `scripts/`**. Those are filesystem tools by
 * construction — `collect-manual.ts` reads all of `docs/` — so a suite importing one reads the
 * tree without a single `readdirSync` of its own. Found by an adversarial review the day
 * `manual.test.ts` was written, which sat outside the net while comparing the shipped manual to
 * thirty-eight markdown files.
 *
 * Measured the day the first module was extracted: the detector found 36 guards and
 * `no-bare-locale-compare.test.ts` was not among them — a guard silently outside the short loop,
 * which is the exact failure the ways below exist to prevent. **Extracting shared reading is a
 * good move that MUST come with a line here**, and the count is the only proof: the three window
 * guards that gave up their own glob were counted before and after, 41 both times.
 *
 * `design/test-harness` joined on 2026-08-16, and it had been missing since the day it was
 * written: 49 guards before, 53 after. Found by an adversarial review, not by the floor, which a
 * silent drop of four never reaches.
 *
 * **That fix was half of one, and the count is what hid it.** It taught the rule the qualified
 * spelling only, so it caught the five consumers that live elsewhere and none of the five that
 * sit beside the module — the count went up, which reads as success. A second review found them
 * the next day: 53 before, 55 after, `styles.test.ts` and `spacing.test.ts` having had no other
 * way in. *A count that rises says a rule caught something, never that it caught everything.*
 */
function borrowsTheSweep(code: string): boolean {
  // Any depth of `../`, not just the sibling: a guard one folder down imports `'../source-files'`
  // and would have dropped out of the net exactly like the one this function was added for. The
  // review caught the two literal spellings before anyone wrote that guard.
  //
  // `(design/)?` is the third spelling, and it cost a day: the five guards that SIT BESIDE
  // `test-harness.ts` write `'./test-harness'`, which the folder-qualified form does not match.
  // The line added for it on 2026-08-16 caught its five distant consumers and none of its
  // neighbours — a fix measured by a count that went up, which is exactly how a half-fix looks.
  return /from '\.[./]*\/(source-files|window-sources|(design\/)?test-harness)'|from '@main\/source-files'|from '@\/(window-sources|design\/test-harness)'|from '\.[./]*\/scripts\/[\w-]+\.ts'/.test(
    code,
  )
}

/**
 * Whether a test reads sources it never imports.
 *
 * Five ways. The fourth was missing until a review found it on 2026-08-13: a wide
 * `import.meta.glob`, a walk of the disk, a read of a file that is data rather than a module
 * (`vitest.config.ts` for the test projects, `index.css` for the design tokens), and a read
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

/**
 * Every suite under `folder`, whatever it reads.
 *
 * Exported because a guard that sweeps the SUITES rather than the sources has nowhere else to get
 * them: `source-files.ts` excludes `.test.ts` by design. Two walks of the same tree would drift.
 */
export function testFilesUnder(folder: string): string[] {
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
