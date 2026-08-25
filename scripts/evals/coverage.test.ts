import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { actionsReaching, type ActionName } from '@shared/domain/assistant'
import { COVERAGE, rankOf, uncoveredActions } from './coverage'
import { SCENARIOS } from './scenarios'

/**
 * 🛑 The registry publishes every one of its actions as an MCP tool, so a tool the batterie
 * never reaches is a tool nobody has seen work. This holds the two lists against each other.
 *
 * The `Record<ActionName, …>` of `coverage.ts` already stops an action being ADDED without an
 * answer; what is left to a test is the other three ways the table lies: a rank that names no
 * scenario, an action declared covered that the fake studio cannot even play, and the roll of
 * what is still measured by nothing — written out rather than counted, because a count is green
 * the day one hole is filled and another is dug.
 */

/**
 * Actions no request of the batterie exercises. **Empty, and it is to stay empty**: every action
 * the registry publishes is measured by at least one request.
 *
 * 🛑 A list and not a count, so an action added with `[]` turns the gate red by NAME rather than
 * by a number nobody can act on. The empty lists of `coverage.ts` say the same thing; what this
 * second writing buys is a hole that cannot be waved through in a diff.
 */
const AWAITING: readonly ActionName[] = []

/**
 * What the fake studio can play, read off the `case` labels of its modules.
 *
 * 🛑 Its blind spot, in clear: this reads the TEXT of those files, so an action dispatched any
 * other way than by a `case` of its own is invisible here and would be reported as unmodelled.
 * Every fake dispatches by `case` today; the day one does not, this is what has to change.
 */
const modelled = (): ReadonlySet<string> => {
  const dir = 'scripts/evals'
  const names = new Set<string>()
  for (const file of readdirSync(dir).filter(one => /^fake.*\.ts$/.test(one))) {
    if (file.includes('.test.')) continue

    const source = readFileSync(`${dir}/${file}`, 'utf8')
    for (const found of source.matchAll(/case '([a-zA-Z]+\.[a-zA-Z]+)':/g))
      names.add(found[1] ?? '')
  }

  return names
}

describe('the MCP surface and the batterie', () => {
  it('names every action the MCP server publishes', () => {
    const published = actionsReaching('mcp').map(one => one.name)
    const named = Object.keys(COVERAGE)

    expect([...named].sort()).toEqual([...published].sort())
  })

  it('cites only ranks the batterie actually carries', () => {
    const ranks = new Set(SCENARIOS.map(one => rankOf(one.name)))
    const ghosts = Object.entries(COVERAGE).flatMap(([action, cited]) =>
      cited.filter(rank => !ranks.has(rank)).map(rank => `${action} → ${rank}`),
    )

    expect(ghosts).toEqual([])
  })

  /**
   * 🛑 An action the fake studio has no answer for is scored BLIND: the bench reports it under
   * « not modelled » and the scenario passes or fails on something else entirely. Held on the
   * whole registry rather than on what the table declares — a family published without a
   * `case` of its own goes straight past every other guard here.
   */
  it('leaves no action of the registry for the fake studio to score blind', () => {
    const plays = modelled()
    const blind = actionsReaching('mcp')
      .map(one => one.name)
      .filter(name => !plays.has(name))

    expect(blind).toEqual([])
  })

  // Sorted on both sides: the table reads in registry order, which is worth keeping, and a
  // reordering there is not a coverage change.
  it('leaves exactly these actions measured by nothing', () => {
    expect([...uncoveredActions()].sort()).toEqual([...AWAITING].sort())
  })
})
