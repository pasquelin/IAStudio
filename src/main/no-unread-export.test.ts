import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PROJECT_TREES,
  SOURCE_ROOT,
  WHOLE_PROJECT,
  exportedNames,
  sourceFiles,
} from './sourceFiles'
import { testFilesUnder } from './wideGuards'

/**
 * No VALUE is published outside the main process without a reader.
 *
 * `pnpm unused:main` is knip, and the name IS its scope: `measure-tools.test.ts` records the five
 * configurations tried in vain to widen it. The three other trees therefore had no reader of this
 * kind, and seven exported functions and constants were sitting there unread — the oldest since
 * 07/08. This is not a sixth attempt at knip: it reads the sources the way the guards next door
 * already do, which is how it reaches where knip could not.
 *
 * **Values only, and the reason is not symmetry.** Seven TYPES are unread the same way and are
 * NOT held here, because deleting one is not always the fix: `UnaccountedPath`
 * (`shared/domain/settingsRegistry.ts`) is read by nobody on purpose — its export is what keeps a
 * compile-time check alive, and removing it would disarm the check this guard exists to imitate.
 * A value never has that property: unread, it is code that ships and never runs.
 *
 * **What it does not see, in clear.** A value whose only reader is its own test PASSES — tests
 * count as readers, deliberately: 84 names are read by no production file, and calling all of
 * them dead would drown the seven that no file reads at all. "Tested but never called" is a real
 * question and a different one. A name a registry reaches by string passes too, since the sweep
 * matches identifiers, and every blind spot of `exportedNames` is inherited.
 *
 * **The direction of the error is chosen**: it under-reports and never accuses wrongly. A name
 * appearing anywhere else — as a property, in a comment, inside a sentence — counts as read.
 */
const [, ...OUTSIDE_MAIN] = PROJECT_TREES

/**
 * Identifiers, not words: a longer name that merely CONTAINS a shorter one must not read as a
 * use of it. Written with a name no module declares — quoting a real one here would count as its
 * reader and hide it, which cost this guard one finding before the example was changed.
 */
const IDENTIFIERS = /[A-Za-z_$][\w$]*/g

const occurrencesOf = (name: string, code: string): number =>
  (code.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length

describe('no unread value export', () => {
  it(
    'lets no tree outside the main process publish a value nothing reads',
    () => {
      const code = new Map(
        testFilesUnder(SOURCE_ROOT, /\.tsx?$/).map(path => [path, readFileSync(path, 'utf8')]),
      )

      const spread = new Map<string, number>()
      for (const text of code.values())
        for (const word of new Set(text.match(IDENTIFIERS) ?? []))
          spread.set(word, (spread.get(word) ?? 0) + 1)

      const unread: string[] = []
      for (const tree of OUTSIDE_MAIN)
        for (const path of sourceFiles(tree)) {
          const text = code.get(path) ?? ''
          for (const [name, kind] of exportedNames(text))
            // In one file, and once in it: the declaration itself, and nothing else anywhere.
            if (kind === 'value' && spread.get(name) === 1 && occurrencesOf(name, text) <= 1)
              unread.push(`${relative(SOURCE_ROOT, path)}: ${name}`)
        }

      expect(unread.sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )
})
