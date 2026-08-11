import { describe, expect, it } from 'vitest'
import { budgetsIn, carried, matches, slackOf } from '../../scripts/coverage-slack.mjs'

/** A summary as vitest writes it, keyed by absolute path, with only the fields the guard reads. */
const ROOT = '/repo/'
const summary = (files: Record<string, [number, number]>): object =>
  Object.fromEntries(
    Object.entries(files).map(([path, [statements, branches]]) => [
      `${ROOT}${path}`,
      {
        statements: { total: statements, covered: 0 },
        branches: { total: branches, covered: 0 },
      },
    ]),
  )

describe('reading the budgets out of the config', () => {
  it('takes the budgets and leaves the percentages', () => {
    const config = `thresholds: {
      'src/a/**': { statements: -10, branches: -4 },
      'src/b.ts': { statements: 100, branches: 100 },
    }`

    expect(budgetsIn(config)).toEqual([{ glob: 'src/a/**', statements: -10, branches: -4 }])
  })

  /**
   * The same trap `coverage-thresholds.test.ts` names on the same file: this guard explains
   * budgets in prose, so a commented one would be read as declared.
   */
  it('ignores a budget written inside a comment', () => {
    const config = `thresholds: {
      // was 'src/a/**': { statements: -99, branches: -99 } before it was covered
      'src/a/**': { statements: -10, branches: -4 },
    }`

    expect(budgetsIn(config)).toHaveLength(1)
  })
})

describe('deciding what a glob covers', () => {
  it('takes everything under a trailing star-star', () => {
    expect(matches('src/a/deep/file.ts', 'src/a/**')).toBe(true)
    expect(matches('src/ab/file.ts', 'src/a/**')).toBe(false)
  })

  it('takes a plain path only when it is that path', () => {
    expect(matches('src/a.ts', 'src/a.ts')).toBe(true)
    expect(matches('src/a.ts.map', 'src/a.ts')).toBe(false)
  })

  // `src/main/{updater.ts,update/**}` — one budget over a file and a folder at once.
  it('takes either side of a brace, whichever shape each side is', () => {
    const glob = 'src/main/{updater.ts,update/**}'

    expect(matches('src/main/updater.ts', glob)).toBe(true)
    expect(matches('src/main/update/check.ts', glob)).toBe(true)
    expect(matches('src/main/updater.test.ts', glob)).toBe(false)
  })
})

describe('the room a budget has left', () => {
  it('sums what the files under a glob carry', () => {
    const held = carried(
      summary({ 'src/a/one.ts': [3, 1], 'src/a/two.ts': [4, 2] }),
      'src/a/**',
      ROOT,
    )

    expect(held).toEqual({ statements: 7, branches: 3 })
  })

  it('leaves out what another glob holds', () => {
    const held = carried(
      summary({ 'src/a/one.ts': [3, 1], 'src/b/two.ts': [9, 9] }),
      'src/a/**',
      ROOT,
    )

    expect(held).toEqual({ statements: 3, branches: 1 })
  })

  /**
   * The number the guard exists for: a budget of 10 over a folder carrying 7 has granted three.
   * Negative would mean the gate is already red, which is the runner's job to say, not this one's.
   */
  it('reports the gap between the budget and what is carried', () => {
    const config = `thresholds: { 'src/a/**': { statements: -10, branches: -4 } }`

    expect(slackOf(config, summary({ 'src/a/one.ts': [7, 4] }), ROOT)).toEqual([
      { glob: 'src/a/**', statements: 3, branches: 0 },
    ])
  })

  it('counts a glob that no file matches as entirely granted', () => {
    const config = `thresholds: { 'src/gone/**': { statements: -12, branches: -8 } }`

    expect(slackOf(config, summary({ 'src/a/one.ts': [7, 4] }), ROOT)).toEqual([
      { glob: 'src/gone/**', statements: 12, branches: 8 },
    ])
  })
})
