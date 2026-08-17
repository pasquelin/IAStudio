import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEAST_GUARDS, readsTheTree, wideGuardsUnder } from './wideGuards'

const ROOT = join(import.meta.dirname, '..', '..')
const GUARDED = wideGuardsUnder(join(ROOT, 'src')).map(path => path.replace(`${ROOT}/`, ''))

describe('finding the tests no import graph reaches', () => {
  it('sees a glob standing for files it does not name, and leaves a single-file one alone', () => {
    expect(readsTheTree("const all = import.meta.glob('./**/*.tsx', { query: '?raw' })")).toBe(true)
    expect(
      readsTheTree("const one = import.meta.glob('./PropertyRow.tsx', { query: '?raw' })"),
    ).toBe(false)
  })

  /**
   * One folder deep counts. Both of these are real — `SettingLine` and `property-line` read their
   * neighbours through `?raw` — and a net that only knew `**` left them out while they are exactly
   * what it exists for.
   */
  it('sees a wildcard that stays in its own folder', () => {
    expect(readsTheTree("import.meta.glob('./*.tsx', { query: '?raw' })")).toBe(true)
    expect(readsTheTree("import.meta.glob('./*Field.tsx', { query: '?raw' })")).toBe(true)
  })

  it('holds the two the narrow reading missed', () => {
    expect(GUARDED).toContain('src/renderer/src/settings/SettingLine.test.tsx')
    expect(GUARDED).toContain('src/renderer/src/design/property-line.test.ts')
  })

  /**
   * A path worked out from the suite's own location reaches the repository; a fixture reads from
   * a temporary folder instead. These four read `index.html`, the notices, the `.lproj` strings
   * and the config files, and nothing imports any of them.
   */
  it('sees a read anchored on the suite own location, and not a fixture', () => {
    expect(readsTheTree("readFileSync(join(import.meta.dirname, '..', 'LICENSE'), 'utf8')")).toBe(
      true,
    )
    expect(readsTheTree("readFileSync(new URL('../index.html', import.meta.url), 'utf8')")).toBe(
      true,
    )
    expect(
      readsTheTree("const dir = await mkdtemp(tmpdir())\nreadFileSync(join(dir, 'a.json'))"),
    ).toBe(false)
  })

  it('holds the four that read the repository without importing it', () => {
    expect(GUARDED).toEqual(
      expect.arrayContaining([
        'src/main/window/csp.test.ts',
        'src/main/licences.test.ts',
        'src/main/permission-strings.test.ts',
        'src/main/gate-caches.test.ts',
      ]),
    )
  })

  it('sees a walk of the disk and a read of what is data rather than a module', () => {
    expect(readsTheTree("readdirSync(join(ROOT, 'src'))")).toBe(true)
    expect(readsTheTree("readFileSync('vitest.config.ts', 'utf8')")).toBe(true)
    expect(readsTheTree("import sheet from './index.css?raw'")).toBe(true)
  })

  it('leaves an ordinary suite alone, which is what keeps the selection worth making', () => {
    expect(readsTheTree("import { Tree } from './Tree'\nrender(<Tree />)")).toBe(false)
  })

  /**
   * A guard that borrows `sourceFiles.ts` reads the tree without a `readdirSync` of its own — and
   * the day that module was extracted, `no-bare-locale-compare.test.ts` fell out of the net exactly
   * that way while the count still read 36 and looked healthy.
   */
  it('sees the suite that borrows the shared sweep rather than writing one', () => {
    expect(readsTheTree("import { sourceFiles } from './sourceFiles'")).toBe(true)
    expect(readsTheTree("import { PROJECT_TREES } from '@main/sourceFiles'")).toBe(true)
    // A guard one folder down, which the first version of the rule would have dropped.
    expect(readsTheTree("import { sourceFiles } from '../sourceFiles'")).toBe(true)
    expect(readsTheTree("import { sourceFiles } from '../../sourceFiles'")).toBe(true)
    expect(GUARDED).toContain('src/main/no-bare-locale-compare.test.ts')
    expect(GUARDED).toContain('src/main/no-hardcoded-text.test.ts')
  })

  /**
   * The three spellings of the renderer's own sweep, and the reason all three are named: the
   * guards that sit BESIDE `test-harness.ts` write the bare one, those elsewhere write the
   * folder-qualified one. A rule taught only the second caught five guards and left five others
   * out — two of them with no other way in, and the floor far too high to notice.
   */
  it('sees the three ways the renderer sweep is borrowed', () => {
    expect(readsTheTree("import { WRITTEN_SOURCES } from './test-harness'")).toBe(true)
    expect(readsTheTree("import { WRITTEN_SOURCES } from '../design/test-harness'")).toBe(true)
    expect(readsTheTree("import { SUITE_SOURCES } from '@/design/test-harness'")).toBe(true)
    expect(GUARDED).toContain('src/renderer/src/design/spacing.test.ts')
    expect(GUARDED).toContain('src/renderer/src/stores/job-fixtures.test.ts')
  })

  /**
   * The one the whole short loop rests on. `no-hardcoded-text` reads every component through
   * `?raw`, so touching a component selects that component's own tests and not this one — the
   * green that would let a hardcoded word merge.
   */
  it('holds the guard that reads every component, which nothing imports', () => {
    expect(GUARDED).toContain('src/renderer/src/no-hardcoded-text.test.ts')
  })

  /** Why a floor at all is on `LEAST_GUARDS`; this is it checked against the tree it will read. */
  it('finds enough of them that a broken detector would say so', () => {
    expect(GUARDED.length).toBeGreaterThanOrEqual(LEAST_GUARDS)
  })
})
