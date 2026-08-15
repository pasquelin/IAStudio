import { describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { maxOffsetFor, maxScrollTopFor, placeRows, rowAtOffset, rowsHeight } from './band'

const rows = [{ height: 20 }, { height: 50 }, { height: 30 }]

describe('stacking rows', () => {
  it('stacks each row under the ones before it', () => {
    expect(placeRows(rows).map(placed => placed.offset)).toEqual([0, 20, 70])
  })

  it('answers nothing for an empty stack rather than throwing', () => {
    expect(placeRows([])).toEqual([])
    expect(rowsHeight([])).toBe(0)
  })

  it('adds the heights, whatever they are', () => {
    expect(rowsHeight(rows)).toBe(100)
  })

  it('carries the row itself through, not a copy of its height', () => {
    const first = { height: 20, id: 'a' }
    expect(placeRows([first])[0]?.item).toBe(first)
  })
})

describe('finding the row under a point', () => {
  it('answers the row a distance falls inside', () => {
    expect(rowAtOffset(rows, 0)?.offset).toBe(0)
    expect(rowAtOffset(rows, 19)?.offset).toBe(0)
    expect(rowAtOffset(rows, 20)?.offset).toBe(20)
    expect(rowAtOffset(rows, 69)?.offset).toBe(20)
  })

  it('answers nothing above the first row — that band belongs to the ruler', () => {
    expect(rowAtOffset(rows, -1)).toBeNull()
  })

  it('answers nothing past the last row rather than clamping to it', () => {
    expect(rowAtOffset(rows, 100)).toBeNull()
    expect(rowAtOffset(rows, 5_000)).toBeNull()
  })

  it('answers nothing at all when there is no row', () => {
    expect(rowAtOffset([], 0)).toBeNull()
  })
})

describe('how far the view may travel', () => {
  it('stops once the end of the band reaches the middle of the strip', () => {
    // 800 px at 100 px per second sees eight seconds, so the offset stops four short of the end.
    expect(maxOffsetFor(10 * SECOND, 100 / SECOND, 800)).toBe(6 * SECOND)
  })

  it('refuses to travel at all when the whole band already fits', () => {
    expect(maxOffsetFor(2 * SECOND, 100 / SECOND, 800)).toBe(0)
  })

  it('stops scrolling once the last row is in view, ruler excluded', () => {
    expect(maxScrollTopFor(300, 200, 24)).toBe(124)
  })

  it('refuses to scroll when every row already fits', () => {
    expect(maxScrollTopFor(100, 400, 24)).toBe(0)
  })
})
