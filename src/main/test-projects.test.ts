import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import config from '../../vitest.config'

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
 * This list is read as TEXT, exactly as `coverage-budgets.ts` reads the same file: `DOM_BOUND` is
 * a local constant, and what reaches `include` is already flattened with a glob beside it. The
 * pool cases below import the config instead — see their own note; a file needing both is worth
 * one sentence, not a rule.
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

/**
 * A project inherits nothing from the root `test` block unless it says `extends`, which none of
 * these do — the note on `TEST_TIMEOUT` says the first half, and a review measured both: with the
 * pool set at the root alone, all three projects answer `child_process`; add `extends: true` to
 * one and it inherits after all. This case then goes red over a project that runs on threads, a
 * false positive it errs towards rather than away from.
 *
 * So a project added without one silently runs on processes, and nothing else would go red: the
 * pool changes no verdict, only what the run costs.
 *
 * **Read as a VALUE, not as text**, and that is the whole lesson of this case. Six versions parsed
 * `vitest.config.ts` as a string, and six were green while a project ran on the default — beaten
 * in turn by a comment containing `pool:`, a project without a `name`, a project declaring neither
 * `pool` nor `environment`, two pools offsetting a project with none, a spread, and finally a
 * `test: { … }` written on one line, which Prettier keeps folded because it fits in a hundred
 * columns. Each fix was narrower than the next way of writing the same config.
 *
 * Importing it ends that: whatever shape the file takes, `test.projects` is the list Vitest gets.
 * The one shape this cannot follow is a project declared in ANOTHER file and referenced by path —
 * so a string entry is refused rather than trusted, which is a rule this repository can live with.
 */
describe('each test project stating its own pool', () => {
  const projects = config.test?.projects ?? []

  it('reads the projects at all, so the cases below are not judging an empty list', () => {
    expect(projects.length).toBeGreaterThan(2)
  })

  it('gives every one of them a pool', () => {
    for (const [index, project] of projects.entries()) {
      expect(
        settled(project),
        `project ${index} is a path, a promise or a function — nothing here can read its pool`,
      ).toBe(true)
      expect(poolOf(project), `project ${index} states no pool`).toBeDefined()
    }
  })
})

/**
 * An entry Vitest resolves later — a path to another config, a promise, a function — is one whose
 * pool no test can read at this point. Refused rather than skipped: skipping is how a project ends
 * up on the default with every case green.
 */
function settled(project: unknown): project is object {
  return typeof project === 'object' && project !== null && !(project instanceof Promise)
}

function poolOf(project: unknown): unknown {
  if (!settled(project) || !('test' in project)) return undefined

  const { test } = project
  return typeof test === 'object' && test !== null && 'pool' in test ? test.pool : undefined
}
