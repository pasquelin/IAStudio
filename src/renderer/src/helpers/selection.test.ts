import { describe, expect, it } from 'vitest'
import { applySelection, pickFrom, rangeBetween } from './selection'

const NONE = { shiftKey: false, metaKey: false, ctrlKey: false }

describe('applySelection', () => {
  it('replaces whatever was selected', () => {
    expect(applySelection(['a', 'b'], ['c'], 'replace')).toEqual(['c'])
  })

  it('drops duplicates while replacing', () => {
    expect(applySelection([], ['a', 'b', 'a'], 'replace')).toEqual(['a', 'b'])
  })

  it('empties the selection when it replaces with nothing', () => {
    expect(applySelection(['a', 'b'], [], 'replace')).toEqual([])
  })

  it('adds an unselected id as the new anchor', () => {
    expect(applySelection(['a', 'b'], ['c'], 'toggle')).toEqual(['a', 'b', 'c'])
  })

  it('removes an id that was already selected', () => {
    expect(applySelection(['a', 'b', 'c'], ['b'], 'toggle')).toEqual(['a', 'c'])
  })

  it('hands the anchor back to the previous id when the anchor is toggled off', () => {
    expect(applySelection(['a', 'b'], ['b'], 'toggle').at(-1)).toBe('a')
  })

  it('leaves the selection alone when it toggles nothing', () => {
    expect(applySelection(['a'], [], 'toggle')).toEqual(['a'])
  })

  // A click that asks for what is already held must not re-render every panel watching it.
  it('hands back the very same array when nothing moves', () => {
    const current = ['a', 'b']
    expect(applySelection(current, ['a', 'b'], 'replace')).toBe(current)
    expect(applySelection(current, [], 'toggle')).toBe(current)

    const empty: readonly string[] = []
    expect(applySelection(empty, [], 'replace')).toBe(empty)
  })
})

describe('pickFrom', () => {
  const rows = ['a', 'b', 'c']

  it('replaces on a plain click', () => {
    expect(pickFrom(rows, 'a', 'c', NONE)).toEqual({ ids: ['c'], mode: 'replace' })
  })

  it('toggles under either command or control, so both platforms answer alike', () => {
    expect(pickFrom(rows, 'a', 'c', { ...NONE, metaKey: true }).mode).toBe('toggle')
    expect(pickFrom(rows, 'a', 'c', { ...NONE, ctrlKey: true }).mode).toBe('toggle')
  })

  it('extends from the anchor under shift', () => {
    expect(pickFrom(rows, 'a', 'c', { ...NONE, shiftKey: true })).toEqual({
      ids: ['a', 'b', 'c'],
      mode: 'replace',
    })
  })

  // Toggling is the coarser gesture: a range needs an order, and toggling never does.
  it('prefers toggling when both modifiers are held', () => {
    expect(pickFrom(rows, 'a', 'c', { ...NONE, shiftKey: true, metaKey: true }).mode).toBe('toggle')
  })
})

describe('rangeBetween', () => {
  const rows = ['a', 'b', 'c', 'd']

  it('spans both ends, inclusive', () => {
    expect(rangeBetween(rows, 'b', 'd')).toEqual(['b', 'c', 'd'])
  })

  it('puts the target last when the range runs backwards', () => {
    expect(rangeBetween(rows, 'd', 'b')).toEqual(['d', 'c', 'b'])
  })

  it('is the target alone when it is its own start', () => {
    expect(rangeBetween(rows, 'c', 'c')).toEqual(['c'])
  })

  it('is a plain click when there is no anchor to run from', () => {
    expect(rangeBetween(rows, undefined, 'c')).toEqual(['c'])
    expect(rangeBetween(rows, 'ghost', 'c')).toEqual(['c'])
  })

  it('selects nothing when the target is not a row', () => {
    expect(rangeBetween(rows, 'a', 'ghost')).toEqual([])
  })
})
