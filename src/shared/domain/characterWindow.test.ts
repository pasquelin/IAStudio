import { describe, expect, it } from 'vitest'
import { characterAssetOf, characterWindowRoute, isCharacterWindowRoute } from './characterWindow'

describe('the skeleton window route', () => {
  it('is read with or without the fragment mark, as the main process loads it', () => {
    const route = characterWindowRoute('asset-1')

    expect(isCharacterWindowRoute(`#${route}`)).toBe(true)
    expect(isCharacterWindowRoute(route)).toBe(true)
  })

  it('names the character it was opened on', () => {
    expect(characterAssetOf(`#${characterWindowRoute('asset 1/é')}`)).toBe('asset 1/é')
  })

  it('is not any other window of the studio', () => {
    expect(isCharacterWindowRoute('#settings')).toBe(false)
    expect(isCharacterWindowRoute('')).toBe(false)
  })

  // The fragment is the one input this side does not build: a hand-edited URL opens empty.
  it('names nobody for a fragment that carries no character', () => {
    expect(characterAssetOf('#character/')).toBeNull()
    expect(characterAssetOf('#character/%E0%A4%A')).toBeNull()
    expect(characterAssetOf('#settings')).toBeNull()
  })
})
