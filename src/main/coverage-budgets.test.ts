import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  budgetsIn,
  carried,
  granted,
  LEAST_BUDGETS,
  matches,
  slackOf,
  unmatched,
  type Slack,
  type Summary,
} from './coverage-budgets'

/** A summary as vitest writes it, keyed by absolute path, with only the fields the guard reads. */
const ROOT = '/repo/'
const tally = (statements: number, branches: number) => ({
  statements: { total: statements, covered: 0 },
  branches: { total: branches, covered: 0 },
})

const summary = (files: Record<string, [number, number]>): Summary =>
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

  // Vitest keys the summary by absolute path, but a caller may hand a relative one: same answer.
  it('reads a path that is already relative', () => {
    const held = carried({ 'src/a/one.ts': tally(3, 1) }, 'src/a/**', ROOT)

    expect(held).toEqual({ statements: 3, branches: 1 })
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

describe('deciding which budgets have been granted room', () => {
  const rows: Slack[] = [
    { glob: 'src/tight/**', statements: 3, branches: 0 },
    { glob: 'src/wide/**', statements: 45, branches: 2 },
    { glob: 'src/branchy/**', statements: 1, branches: 40 },
  ]

  it('names the ones past the ceiling, on either count', () => {
    expect(granted(rows, 30).map(row => row.glob)).toEqual(['src/wide/**', 'src/branchy/**'])
  })

  it('names none when every budget sits under it', () => {
    expect(granted(rows, 50)).toEqual([])
  })

  /**
   * What no case here can hold: `MAX_SLACK` itself. Raising it disarms the guard and every test
   * in this file stays green — the ceiling is a decision, and only a diff read by someone shows
   * it moving. Written down rather than papered over with an assertion on a literal.
   */
  it('takes its ceiling from the caller, so the constant is the only thing left to review', () => {
    expect(granted(rows, 44).map(row => row.glob)).toEqual(['src/wide/**'])
  })
})

describe('the shapes a config can be written in', () => {
  /**
   * The defect that made this file exist: Prettier wraps a long key across lines, and a parser
   * that reads `branches: N }` without a trailing comma sees 18 budgets where 20 are declared.
   * The two it missed held 137 and 131 of room.
   */
  it('reads a budget Prettier has wrapped, trailing comma and all', () => {
    const config = `thresholds: {
      'src/short/**': { statements: -4, branches: -2 },
      'src/very/long/glob/{one,two,three,four}/**': {
        statements: -270,
        branches: -250,
      },
    }`

    expect(budgetsIn(config)).toEqual([
      { glob: 'src/short/**', statements: -4, branches: -2 },
      { glob: 'src/very/long/glob/{one,two,three,four}/**', statements: -270, branches: -250 },
    ])
  })

  // The floor that turns "read nothing" into an error rather than a green empty table.
  it('reads every budget the real config declares, so the floor means something', () => {
    const config = readFileSync(join(import.meta.dirname, '..', '..', 'vitest.config.ts'), 'utf8')

    expect(budgetsIn(config).length).toBeGreaterThanOrEqual(LEAST_BUDGETS)
  })
})

describe('a glob that no longer matches anything', () => {
  const held = summary({ 'src/a/one.ts': [3, 1] })

  /**
   * Renaming a folder turns its budget into a no-op — `vitest.config.ts` names the trap and this
   * is what holds it. It is also the one contortion the slack ceiling cannot see: a tight budget
   * over nothing reads as a few units of room, well under thirty.
   */
  it('is named, however tight its budget', () => {
    const config = `thresholds: { 'src/gone/**': { statements: -3, branches: -1 } }`
    const rows = slackOf(config, held, ROOT)

    expect(unmatched(rows, held, ROOT)).toEqual(['src/gone/**'])
  })

  // A glob covered whole carries nothing either, and must not be mistaken for a renamed one.
  it('is not confused with a glob whose files are all covered', () => {
    const covered = summary({ 'src/a/one.ts': [0, 0] })
    const config = `thresholds: { 'src/a/**': { statements: -3, branches: -1 } }`

    expect(unmatched(slackOf(config, covered, ROOT), covered, ROOT)).toEqual([])
  })
})
