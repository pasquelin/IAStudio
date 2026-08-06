import { describe, expect, it } from 'vitest'
import { MODEL_PERIODS, MODEL_SORTS } from '@shared/domain/model'
import { parseModelQuery } from './validation'

describe('model query validation', () => {
  /**
   * The schema used to retype the unions by hand, and fell behind: `sort: 'oldest'` reached
   * the menu while the handler still rejected it, surfacing as "an unexpected error".
   */
  it('accepts every sort the panel can offer', () => {
    for (const sort of MODEL_SORTS) {
      expect(parseModelQuery({ sort })).toEqual({ sort })
    }
  })

  it('accepts every period the panel can offer', () => {
    for (const since of MODEL_PERIODS) {
      expect(parseModelQuery({ since })).toEqual({ since })
    }
  })

  it('still refuses a value no facet offers', () => {
    expect(() => parseModelQuery({ sort: 'cheapest' })).toThrow()
  })

  // `limit` sizes the walk the registry performs before answering.
  it('refuses a page size that would freeze the main process', () => {
    expect(() => parseModelQuery({ limit: 10_000 })).toThrow()
  })
})
