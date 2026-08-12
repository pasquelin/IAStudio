import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Which renderer tests are told they need a browser, and whether that list still describes files.
 *
 * `vitest.config.ts` splits the renderer in two: every `.test.tsx` and the `.test.ts` named by
 * `DOM_BOUND` run under jsdom with the renderer setup; the rest run under `node`. Measured over
 * five alternating pairs on 2026-08-12: 547 s of CPU for the whole suite before, 385 s after.
 *
 * No count of either side is written here. Both move every time a session adds a test file, and
 * a cardinal that rots is what a reader trusts and a reviewer has to re-derive.
 *
 * The list is read as text rather than imported, exactly as `coverage-budgets.ts` reads the same
 * file: importing it would run the config, plugins included, for a handful of paths.
 *
 * Under `src/main` for the reason `coverage-budgets.ts` gives: the file it guards sits at the
 * repository root, and `src/shared` compiles for the renderer.
 */
const ROOT = join(import.meta.dirname, '..', '..')
const CONFIG = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8')

const listed = [
  ...(CONFIG.match(/const DOM_BOUND = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g),
]
  .map(match => match[1])
  .filter((path): path is string => path !== undefined)

describe('the renderer tests that are told they need a browser', () => {
  /**
   * A guard that reads nothing passes everything — the failure `coverage-budgets.ts` exists to
   * prevent, one file over. If the parser stops understanding how the list is written, every case
   * below turns green over an empty array.
   */
  it('is read at all, so the cases below are not judging an empty list', () => {
    expect(listed.length).toBeGreaterThan(40)
  })

  /**
   * The trap `vitest.config.ts` already names about a coverage glob, in its other form: a path
   * that no longer exists excludes nothing. The file it named would quietly move to the fast
   * project — where it belongs only if it stopped needing a browser, which nobody checked.
   */
  it('names files that exist', () => {
    for (const path of listed) {
      expect(existsSync(join(ROOT, path)), `${path} is listed but absent`).toBe(true)
    }
  })

  /**
   * `.tsx` is already the jsdom project's whole include. An entry here would say nothing and read
   * as if it did.
   */
  it('names only the `.test.ts` the split is about', () => {
    for (const path of listed) {
      expect(path.endsWith('.test.ts'), `${path} is not a .test.ts`).toBe(true)
      expect(path.startsWith('src/renderer/'), `${path} is not a renderer test`).toBe(true)
    }
  })

  // Listed twice, run twice — and the second entry would look like a second file.
  it('names each file once', () => {
    expect([...new Set(listed)]).toHaveLength(listed.length)
  })

  /**
   * Every path the jsdom project takes comes through the list, so the cases above see them all.
   * A review found the hole: written straight into `include`, a path is guarded by nothing here —
   * it can rot, be duplicated, or name a `.tsx` that the glob beside it already covers.
   */
  it('is the only way a path reaches the jsdom project', () => {
    const include = CONFIG.match(/name: 'renderer',[\s\S]*?include: \[([^\]]*)\]/)?.[1] ?? ''

    expect(include).toContain('...DOM_BOUND')
    expect([...include.matchAll(/'([^']+)'/g)].map(match => match[1])).toEqual([
      'src/renderer/**/*.test.tsx',
    ])
  })
})
