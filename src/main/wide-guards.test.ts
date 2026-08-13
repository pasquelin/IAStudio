import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEAST_GUARDS, readsTheTree, wideGuardsUnder } from './wide-guards'

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
