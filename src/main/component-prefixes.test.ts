import { relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_TREES, SOURCE_ROOT, WHOLE_PROJECT, sourceFiles } from './sourceFiles'
import { testFilesUnder } from './wideGuards'

/**
 * Where a component sits, said by its own name.
 *
 * **The prefix of a component is the folders leading to it, concatenated, counted from the
 * `components/` that holds it.** A file under `Setting/Row/` opens with `SettingRow`, because that
 * is what a reader walked to reach it. A name that drops a folder makes the tree lie: two
 * `ColorControl.tsx` under two parents read as one component in every tab, every import list and
 * every stack trace, and the auto-import takes whichever it finds first.
 *
 * It reads the DISK rather than a list, so a folder created by the next tidy-up is judged the hour
 * it appears. Both halves are swept — sources and suites — because a test follows its component
 * into its folder, and a suite left behind in the folder its component has left is exactly what a
 * rangement produces.
 *
 * **Its blind angles, in clear.** Only a `.tsx` whose stem is PascalCase is judged: a camelCase
 * module written beside a component is exempt, so a helper filed under a folder it has nothing to
 * do with is reported by nobody. It reads PATHS and never what a file EXPORTS, so a well-prefixed
 * name satisfies it whatever it hands out — `file-names.test.ts` holds that half. A file sitting
 * directly in a `components/` folder has an empty prefix and is asked nothing; the rule starts one
 * folder down. And the comparison is `startsWith`, so a folder whose name is a prefix of its
 * sibling's is invisible to it.
 */
const stem = (path: string): string => (path.split(sep).pop() ?? '').split('.')[0] ?? ''

const isPascalCase = (name: string): boolean => /^[A-Z][a-zA-Z0-9]*$/.test(name)

/**
 * The folders between the nearest `components/` and the file, or `null` where none holds it. The
 * NEAREST: a feature may hold one inside another, and the prefix is the one a reader walked last.
 */
function foldersUnder(path: string): readonly string[] | null {
  const parts = path.split(sep)
  const opens = parts.lastIndexOf('components')

  return opens === -1 ? null : parts.slice(opens + 1, -1)
}

/** Whether a file opens with its own folders — true for everything the rule spares. */
function wearsItsPath(path: string): boolean {
  const folders = foldersUnder(path)

  return folders === null || stem(path).startsWith(folders.join(''))
}

/** A component the rule has something to say about: nested, `.tsx`, and named like a component. */
const isPlaced = (path: string): boolean =>
  path.endsWith('.tsx') && isPascalCase(stem(path)) && (foldersUnder(path) ?? []).length > 0

/** Sources and suites both: `sourceFiles` drops the suites, and a suite carries the same prefix. */
const filesOfTree = (tree: string): string[] => [...sourceFiles(tree), ...testFilesUnder(tree)]

const PLACED = PROJECT_TREES.flatMap(filesOfTree).filter(isPlaced)

const reported = (path: string): string => relative(SOURCE_ROOT, path)

describe('a component opens with the folders that lead to it', () => {
  /**
   * What makes the case below mean anything: a sweep finding nothing, or one never reaching past
   * the first folder, reports no offender while checking nothing — and reads exactly as green.
   */
  it('finds components nested deep enough for a prefix to exist at all', () => {
    expect(PLACED.length).toBeGreaterThan(100)
    expect(PLACED.filter(path => (foldersUnder(path) ?? []).length > 1)).not.toEqual([])
  })

  it(
    'gives every component the prefix its folders spell',
    () => {
      const misplaced = PLACED.filter(path => !wearsItsPath(path))

      expect(misplaced.map(reported).sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  /**
   * A rule that has never refused anything refuses nothing. Fabricated paths rather than real ones,
   * so this keeps its meaning the day the tree it would have named is tidied again.
   */
  it('refuses a name that drops a folder of its own path', () => {
    const under = ['features', 'settings', 'components', 'Setting', 'Row'].join(sep)

    expect(wearsItsPath(`${under}${sep}SettingRowColorControl.tsx`)).toBe(true)
    expect(wearsItsPath(`${under}${sep}ColorControl.tsx`)).toBe(false)
    expect(wearsItsPath(`${under}${sep}RowColorControl.tsx`)).toBe(false)
  })

  it('leaves alone a file sitting in a components folder itself', () => {
    expect(wearsItsPath(`components${sep}Button.tsx`)).toBe(true)
  })
})
