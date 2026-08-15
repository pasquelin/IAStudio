import { describe, expect, it } from 'vitest'
import { americanVerbs, americanWords, proseOf } from './spelling-fixtures'

/**
 * The probes of a reading two guards rest on: `bundles.test.ts` for the English bundle,
 * `manual.i18n.test.ts` for the chapters the Help window renders. Both report an empty list on a
 * repository that is already British, so a reading that quietly stopped matching would look
 * exactly like a repository that had stayed clean.
 */
describe('the British spelling of the repository', () => {
  it('tells an American verb from a word that merely ends that way', () => {
    expect(americanVerbs('Vectorize the image')).toEqual(['Vectorize'])
    expect(americanVerbs('Vectorise, then resize the layer')).toEqual([])
    // Anything built on `size` comes with it; `seize` and `capsize` only share the ending.
    expect(americanVerbs('Seize the oversized layer before it capsizes')).toEqual([])
    // Folded onto the LAST `iz`, so an exempt root at the front cannot smuggle a verb in.
    expect(americanVerbs('sizeorganize')).toEqual(['sizeorganize'])
  })

  it('reads an American word whole, never inside a longer one', () => {
    expect(americanWords('The colors it centered')).toEqual(['colors', 'centered'])
    expect(americanWords('The colours it centred')).toEqual([])
    // `concentrate` and `discolour` carry one of the words; neither is the word. `grayscale` is,
    // the manual having settled on `greyscale`.
    expect(americanWords('Concentrate on the discoloured grayscale')).toEqual(['grayscale'])
    // British English licenses a verb and licences nothing: the noun cannot be told from it.
    expect(americanWords('The software is licensed under a licence')).toEqual([])
  })

  /**
   * The canary of a guard that reports an empty list: a `proseOf` that dropped everything would
   * read as a chapter with nothing American in it.
   */
  it('keeps the prose of a chapter and leaves its code behind', () => {
    expect(proseOf('Send the `Authorization` header.')).toContain('Send the')
    expect(americanWords(proseOf('Set `color-burn`, then centre it'))).toEqual([])
    expect(americanVerbs(proseOf('```\nAuthorization: Bearer\n```\nVectorise it'))).toEqual([])
    // Fences first: a backtick inside one must not pair with a later one and eat the prose.
    expect(proseOf('```\nlet a = `x`\n```\nThe color of it')).toContain('The color of it')
    // A link keeps the words a reader sees and drops the path only a machine follows.
    expect(americanWords(proseOf('See [the catalogue](../color-center.md) for it'))).toEqual([])
    expect(americanWords(proseOf('<!-- SCREENSHOT: the colors -->Nothing else'))).toEqual([])
  })
})
