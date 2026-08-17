import { describe, expect, it } from 'vitest'
import type { GitCommit } from './git'
import { laneLayout } from './gitGraph'

/** A commit, named by a letter — the layout only ever compares hashes to parents. */
const commit = (hash: string, ...parents: string[]): GitCommit => ({
  hash,
  parents,
  message: hash,
  author: 'Suite',
  at: '2026-08-17T10:00:00Z',
})

/** Which lane each commit landed in, by hash — what every case below is really asking. */
function lanesOf(commits: readonly GitCommit[]): Record<string, number> {
  return Object.fromEntries(laneLayout(commits).map(row => [row.hash, row.lane]))
}

describe('a history with no branching', () => {
  it('keeps every commit in one lane', () => {
    const rows = laneLayout([commit('c', 'b'), commit('b', 'a'), commit('a')])

    expect(rows.map(row => row.lane)).toEqual([0, 0, 0])
    expect(rows.map(row => row.width)).toEqual([1, 1, 1])
  })

  /** The first commit has no parent, so nothing leaves the bottom of its row. */
  it('draws no line below the very first commit', () => {
    const [row] = laneLayout([commit('a')])

    expect(row?.links).toEqual([])
  })
})

describe('a branch that leaves and comes back', () => {
  /**
   * ```
   *  m      merge, parents c and b
   *  |\
   *  c |    on main
   *  | b    on the branch
   *  |/
   *  a      where they parted
   * ```
   */
  const history = [commit('m', 'c', 'b'), commit('c', 'a'), commit('b', 'a'), commit('a')]

  it('gives the second parent a lane of its own', () => {
    expect(lanesOf(history)).toEqual({ m: 0, c: 0, b: 1, a: 0 })
  })

  it('reserves the width for both lanes on every row, so nothing shifts while scrolling', () => {
    expect(laneLayout(history).map(row => row.width)).toEqual([2, 2, 2, 2])
  })

  /** The merge's own row is where the branch is drawn leaving: lane 0 down to lane 1. */
  it('draws the fork on the merge row', () => {
    const [merge] = laneLayout(history)

    expect(merge?.links).toContainEqual({ from: 0, to: 1 })
  })

  /**
   * The commit both branches came from. Two lanes were waiting for it, and only one dot is drawn
   * — the other column ends there, and is given back rather than running down the rest of the log.
   */
  it('brings the second lane back in at the commit they parted from', () => {
    const rows = laneLayout(history)
    const parted = rows[3]

    expect(parted?.lane).toBe(0)
    expect(parted?.links).toContainEqual({ from: 1, to: 0 })
  })
})

describe('a lane that has been given back', () => {
  /**
   * Two branches, one older than the other and both closed. The column the first gave back at
   * its parting point is the one the second takes — a layout that kept allocating fresh columns
   * would march a long history off the right edge, one dead branch at a time.
   *
   * ```
   *  m1        the newer merge
   *  |\
   *  c |
   *  | b
   *  |/
   *  a         where the newer pair parted, and lane 1 is given back
   *  |
   *  m2        the older merge — takes lane 1 again
   *  |\
   *  f |
   *  | e
   *  |/
   *  g
   * ```
   */
  it('is taken again by the next fork rather than a new column', () => {
    const rows = laneLayout([
      commit('m1', 'c', 'b'),
      commit('c', 'a'),
      commit('b', 'a'),
      commit('a', 'm2'),
      commit('m2', 'f', 'e'),
      commit('f', 'g'),
      commit('e', 'g'),
      commit('g'),
    ])

    expect(rows.every(row => row.width === 2)).toBe(true)
  })
})

describe('two lines that never meet', () => {
  /** Two roots — a repository with an orphan branch. Neither may be drawn in the other's lane. */
  it('keeps each in a lane of its own', () => {
    expect(lanesOf([commit('b'), commit('a')])).toEqual({ b: 0, a: 0 })
  })
})
