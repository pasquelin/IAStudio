import { describe, expect, it } from 'vitest'
import { chunk, DELETE_MAX, GET_BULK_MAX } from './limits'

describe('chunk', () => {
  it('cuts a list into runs of at most the given size, in order', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('leaves a list that already fits in one batch', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]])
  })

  it('gives no batch at all for an empty list', () => {
    // Callers send one request per batch: an empty batch would ask the API for nothing.
    expect(chunk([], 10)).toEqual([])
  })

  it('cuts exactly on the boundary without trailing an empty batch', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('refuses a size that would never finish', () => {
    expect(() => chunk([1], 0)).toThrow()
  })

  it('cuts a full page of ids to what each endpoint accepts', () => {
    const ids = Array.from({ length: 250 }, (_, index) => index)

    expect(chunk(ids, GET_BULK_MAX).map(batch => batch.length)).toEqual([200, 50])
    expect(chunk(ids, DELETE_MAX).map(batch => batch.length)).toEqual([100, 100, 50])
  })
})
