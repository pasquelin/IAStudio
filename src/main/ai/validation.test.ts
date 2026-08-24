import { describe, expect, it } from 'vitest'
import { parseAiModelId } from './validation'

describe('the id of a local model', () => {
  /**
   * Every other id of the boundary trims — `parseModelId` of the catalogue among them. An id
   * kept with its blanks matches no row, and `install` answers a composed overview: the click
   * does nothing and says nothing.
   */
  it('drops the blanks a window sent around it', () => {
    expect(parseAiModelId('  own-3f2a91c40b7e  ')).toBe('own-3f2a91c40b7e')
  })

  it('refuses blanks alone, which name no model', () => {
    expect(() => parseAiModelId('   ')).toThrow()
  })
})
