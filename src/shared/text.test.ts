import { describe, expect, it } from 'vitest'
import { NO_BREAK_SPACE } from './i18n/typography'
import { byCodeUnit, completionFor, foldForSearch } from './text'

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

  /**
   * Built from the constant rather than typed, like the decomposed letter above and for the same
   * reason: the two spaces are told apart by a code point and by nothing else. The bundles bind a
   * figure to its unit with the no-break one, no keyboard offers it, and the settings hint about
   * freeing memory stopped answering to what a hand types the day it was bound.
   */
  it('reads a no-break space as the space a keyboard types', () => {
    expect(foldForSearch(`700${NO_BREAK_SPACE}MB of memory`)).toBe('700 mb of memory')
  })
})

describe('the order of two strings nobody reads as words', () => {
  it('orders ISO stamps chronologically, which is what the format is for', () => {
    const stamps = ['2026-08-13T09:00:00Z', '2026-01-04T23:59:00Z', '2026-08-13T08:59:00Z']

    expect([...stamps].sort(byCodeUnit)).toEqual([
      '2026-01-04T23:59:00Z',
      '2026-08-13T08:59:00Z',
      '2026-08-13T09:00:00Z',
    ])
  })

  /**
   * The whole reason this exists rather than a `localeCompare` with a language pinned to it: the
   * answer must not move with the machine. Swedish files `Ä` after `Z` and Turkish splits the two
   * `i`s, so a collator — any collator — makes the same ids order two ways on two desks.
   */
  it('answers the same on every machine, where a collator would not', () => {
    // `Ä` is U+00C4, past `Z` — so code units put it after, in every language there is.
    expect(byCodeUnit('Ärger', 'Zoo')).toBe(1)

    // And this is the divergence being avoided: French files `Ä` with `A`, Swedish after `Z`.
    expect(Math.sign('Ärger'.localeCompare('Zoo', 'fr'))).toBe(-1)
    expect(Math.sign('Ärger'.localeCompare('Zoo', 'sv'))).toBe(1)
  })

  it('reads a pair as equal only when it is the same string', () => {
    expect(byCodeUnit('a', 'a')).toBe(0)
    expect(byCodeUnit('a', 'b')).toBe(-1)
    expect(byCodeUnit('b', 'a')).toBe(1)
  })
})

describe('the rest of a sentence one has begun to type', () => {
  it('gives what is left to write, spelled as the sentence spells it', () => {
    expect(completionFor('Crée un nouveau projet', 'cr')).toBe('ée un nouveau projet')
  })

  /**
   * The point of folding both sides: a hand that types `cree` is offered the accents back rather
   * than being told the sentence starts otherwise.
   */
  it('answers a hand that skips the accents', () => {
    expect(completionFor('Crée un nouveau projet', 'cree un')).toBe(' nouveau projet')
  })

  it('gives nothing when the sentence begins otherwise, however well a word of it matches', () => {
    expect(completionFor('Crée un nouveau projet', 'projet')).toBeUndefined()
  })

  it('gives nothing when the sentence is already written out', () => {
    expect(completionFor('Crée un nouveau projet', 'Crée un nouveau projet')).toBeUndefined()
  })

  // Nothing is typed, so everything would complete it — six sentences flashing under one caret.
  it('gives nothing for a field holding only spaces', () => {
    expect(completionFor('Crée un nouveau projet', '  ')).toBeUndefined()
  })
})
