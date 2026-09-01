import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SOURCE_ROOT, WHOLE_PROJECT, isLocalSpecifier, resolveSpecifier } from './sourceFiles'
import { testFilesUnder } from './wideGuards'

/**
 * 🛑 **A mock is resolved from the FILE, and vitest says nothing when it resolves to nothing** —
 * the mock never applies, the suite runs the real module, and it stays green. Moving a test one
 * folder down is enough, which is what a rangement does: 773 files moved on 2026-08-31, and one
 * suite was still mocking `./useWaveSurfer` against a hook that had never been its neighbour.
 *
 * **Its blind angles, in clear.** It reads a LITERAL specifier, so one built at runtime is
 * invisible. A package is left alone rather than resolved, `node_modules` being another sweep.
 * A module that is not TypeScript is skipped rather than followed — `resolveSpecifier` answers
 * only for `.ts` and `.tsx`, and a mocked `.json` or `.css` would be ACCUSED, not missed, which
 * is the one failure mode worse than a blind spot. And it says nothing
 * about whether a mock is USED: one that resolves and covers nothing is a different defect.
 */
const MOCKED = /vi\.(?:mock|doMock|unmock|doUnmock)\(\s*['"]([^'"]+)['"]/g

/** What `resolveSpecifier` follows. A `.js` spelt for a `.ts` file is one of them, and lands. */
const A_MODULE_IT_FOLLOWS = /(^|\/)[^/.]+$|\.[cm]?[jt]sx?$/

/** Comments out: the guard on file names explains itself with a `vi.mock('./x')`. */
const stripped = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

/** Each suite with a path it mocks, and where that path leads — `null` where it leads nowhere. */
const MOCKS = testFilesUnder(SOURCE_ROOT).flatMap(suite =>
  [...stripped(readFileSync(suite, 'utf8')).matchAll(MOCKED)]
    .map(match => match[1] ?? '')
    .filter(specifier => isLocalSpecifier(specifier) && A_MODULE_IT_FOLLOWS.test(specifier))
    .map(specifier => ({ suite, specifier, target: resolveSpecifier(specifier, suite) })),
)

describe('a module a suite mocks by path', () => {
  /** A sweep finding nothing reports no offender while checking nothing, and reads as green. */
  it('finds the mocks at all, spelt both ways', () => {
    expect(MOCKS.length).toBeGreaterThan(50)
    expect(new Set(MOCKS.map(({ specifier }) => specifier.startsWith('.'))).size).toBe(2)
  })

  it(
    'still leads to a module, or the mock never applies and nothing says so',
    () => {
      const dangling = MOCKS.filter(({ target }) => target === null).map(
        ({ suite, specifier }) => `${relative(SOURCE_ROOT, suite)} → ${specifier}`,
      )

      expect(dangling.sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  /**
   * A rule that has never refused anything refuses nothing — on a fabricated path, so it keeps its
   * meaning the day the tree it would have named is tidied again.
   */
  it('refuses a neighbour that is not one', () => {
    const suite = `${SOURCE_ROOT}/main/mock-paths.test.ts`

    expect(resolveSpecifier('./sourceFiles', suite)).not.toBeNull()
    expect(resolveSpecifier('./sourceFiles-that-moved', suite)).toBeNull()
    // And the blind angle above, held rather than described: a mocked stylesheet is not accused.
    expect(A_MODULE_IT_FOLLOWS.test('./theme.css')).toBe(false)
    expect(A_MODULE_IT_FOLLOWS.test('@shared/licences.json')).toBe(false)
    expect(A_MODULE_IT_FOLLOWS.test('@/stores/playback')).toBe(true)
  })
})
