import { describe, expect, it } from 'vitest'
import { foldForSearch } from './text'

describe('the shape a text is searched by', () => {
  it('drops the accents a hand skips when it is looking rather than spelling', () => {
    expect(foldForSearch('Forêt d’hiver')).toBe('foret d’hiver')
    expect(foldForSearch('Été')).toBe('ete')
  })

  /**
   * Written by code point, because the two spell the same word and look identical in an editor:
   * `café` is one character, `café` is two. macOS hands the second one out of its own
   * file names, so an asset dropped from Finder used to be unfindable by a name typed here.
   */
  it('reads a composed letter and a decomposed one as the same one', () => {
    expect(foldForSearch('caf\u00e9')).toBe(foldForSearch('cafe\u0301'))
  })

  it('folds the case, so a name found is a name typed either way', () => {
    expect(foldForSearch('VEO Motion')).toBe('veo motion')
  })

  // The apostrophe and the space are not diacritics: a search for `d hiver` is not this one.
  it('leaves everything that is not an accent where it was', () => {
    expect(foldForSearch('L’an 2 000 — n°4')).toBe('l’an 2 000 — n°4')
  })
})
