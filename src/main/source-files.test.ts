import { describe, expect, it } from 'vitest'
import { PROJECT_TREES, sourceFiles } from './source-files'

/**
 * The sweep every guard of the main process borrows, held once rather than re-asserted by each.
 *
 * `no-hardcoded-text` and `no-bare-locale-compare` both carried this case verbatim, which is one
 * copy per guard of a fact about neither of them. A third guard would have made three.
 *
 * Under `src/main` rather than `src/shared`: it walks a disk, and `src/shared` compiles for the
 * renderer.
 */
describe('the sweep the guards read the project through', () => {
  /**
   * An empty result proves nothing unless the files were opened: pointed at a folder that does
   * not exist, every guard borrowing this walk stays green over nothing. The four trees are
   * counted, not assumed.
   *
   * The floor is deliberately far below what the trees hold — it separates "the walk works" from
   * "the walk found one file", and a figure tracking the real count would fail for a folder
   * legitimately split.
   */
  it('opens all four trees, modules and components alike', () => {
    const counts = PROJECT_TREES.map(tree => sourceFiles(tree).length)

    expect(counts).toHaveLength(4)
    expect(counts.every(count => count > 0)).toBe(true)
    expect(counts.reduce((total, count) => total + count, 0)).toBeGreaterThan(600)
  })

  /**
   * Test material is out, `-fixtures` included — the decision `source-files.ts` explains. Asserted
   * on the real sweep rather than on a temporary folder: what the guards actually read is the
   * thing worth holding, and an exclusion that stops matching would let a fixture's label be
   * judged as a word this studio writes.
   */
  it('leaves every test and every fixture out of what the guards judge', () => {
    const swept = PROJECT_TREES.flatMap(tree => sourceFiles(tree))

    expect(swept.filter(path => /\.(test|bench)\.tsx?$/.test(path))).toEqual([])
    expect(swept.filter(path => /-fixtures\.tsx?$/.test(path))).toEqual([])
  })
})
