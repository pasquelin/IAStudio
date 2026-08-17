import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_TRAITS,
  WRITABLE_FORMATS,
  capabilityOf,
  formatOfFile,
  lossesFor,
  type CapabilityTrait,
} from './formatCapability'

const STACKED: readonly CapabilityTrait[] = ['layers', 'blendMode', 'layerMask']

describe('what a format would drop for good', () => {
  it('drops every trait of a stacked document into a flat picture', () => {
    expect(lossesFor(STACKED, 'png')).toEqual(['layers', 'blendMode', 'layerMask'])
  })

  it('drops nothing from a document that is already one flat layer', () => {
    // The rule this makes possible: a picture opened, painted on and saved back stays a picture,
    // with no dialog in the way.
    expect(lossesFor([], 'png')).toEqual([])
  })

  it('drops nothing into a format that carries the studio own data', () => {
    expect(lossesFor(STACKED, 'ora')).toEqual([])
    expect(lossesFor(STACKED, 'img')).toEqual([])
  })

  it('keeps the order the traits were given, so two documents read the same way', () => {
    expect(lossesFor(['liveText', 'layers'], 'jpeg')).toEqual(['liveText', 'layers'])
  })
})

describe('what a file name says its format is', () => {
  it('reads the extension, whatever its case', () => {
    expect(formatOfFile('hero.ORA')).toBe('ora')
    expect(formatOfFile('hero.jpeg')).toBe('jpeg')
    expect(formatOfFile('hero.jpg')).toBe('jpeg')
  })

  /** Not « nothing to lose »: a format this table cannot write has no answer to give at all. */
  it('answers nothing for a format it does not write, and for a name with no extension', () => {
    expect(formatOfFile('scan.tif')).toBeNull()
    expect(formatOfFile('README')).toBeNull()
  })
})

describe('the table itself', () => {
  it('classes every trait exactly once per format, so a new trait cannot slip in unclassed', () => {
    // The defect this guards is the one the module exists to stop. A trait nobody classed would
    // read as carried — and a trait wrongly read as carried is a trait silently lost, which is
    // the whole failure this table was written against.
    const misclassed = WRITABLE_FORMATS.flatMap(format => {
      const { interchange, extended, dropped } = capabilityOf(format)
      const all = [...interchange, ...extended, ...dropped]

      return CAPABILITY_TRAITS.filter(
        trait => all.filter(classed => classed === trait).length !== 1,
      ).map(trait => `${format}: ${trait}`)
    })

    expect(misclassed).toEqual([])
  })

  it('names no trait the union does not carry', () => {
    const unknown = WRITABLE_FORMATS.flatMap(format => {
      const { interchange, extended, dropped } = capabilityOf(format)

      return [...interchange, ...extended, ...dropped]
        .filter(trait => !CAPABILITY_TRAITS.includes(trait))
        .map(trait => `${format}: ${trait}`)
    })

    expect(unknown).toEqual([])
  })
})
