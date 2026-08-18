import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_TRAITS,
  MATERIAL_TRAITS,
  MONTAGE_TRAITS,
  PICTURE_TRAITS,
  TRAITS_OF_DOMAIN,
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

  it('drops nothing into the open format that carries a stack', () => {
    expect(lossesFor(STACKED, 'ora')).toEqual([])
  })

  // « No answer » must never read as « nothing to lose »: an `.otio` has no field for a layer.
  it('drops everything into a format of another domain', () => {
    expect(lossesFor(STACKED, 'otio')).toEqual(STACKED)
    expect(lossesFor(['tracks', 'clipFade'], 'ora')).toEqual(['tracks', 'clipFade'])
  })

  it('drops nothing of a montage into the format that carries a cut', () => {
    expect(lossesFor(MONTAGE_TRAITS, 'otio')).toEqual([])
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
    expect(formatOfFile('Bande.otio')).toBe('otio')
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
      const { domain, interchange, extended, dropped } = capabilityOf(format)
      const all = [...interchange, ...extended, ...dropped]

      return TRAITS_OF_DOMAIN[domain]
        .filter(trait => all.filter(classed => classed === trait).length !== 1)
        .map(trait => `${format}: ${trait}`)
    })

    expect(misclassed).toEqual([])
  })

  // A format that classed a trait of the other domain would answer « carried » for something it
  // has no field for — an `.otio` claiming to hold a layer mask.
  it('names no trait outside its own domain', () => {
    const foreign = WRITABLE_FORMATS.flatMap(format => {
      const { domain, interchange, extended, dropped } = capabilityOf(format)

      return [...interchange, ...extended, ...dropped]
        .filter(trait => !TRAITS_OF_DOMAIN[domain].includes(trait))
        .map(trait => `${format}: ${trait}`)
    })

    expect(foreign).toEqual([])
  })

  /**
   * The two channels `standard_surface` has no input for. They are carried — the studio reads
   * them back — so ⌘S has nothing to warn about; what they are NOT is visible to anyone else.
   */
  it('loses neither occlusion nor cavity into MaterialX, and carries neither into the open', () => {
    expect(lossesFor(['occlusionMap', 'cavityMap'], 'mtlx')).toEqual([])
    expect(capabilityOf('mtlx').interchange).not.toContain('occlusionMap')
    expect(capabilityOf('mtlx').extended).toContain('occlusionMap')
  })

  it('reports a trait of another domain against MaterialX as lost', () => {
    expect(lossesFor(['layers'], 'mtlx')).toEqual(['layers'])
  })

  // That the lists share no value is the COMPILER's to hold — the three trait unions have no
  // overlap, so an assertion here would not even type-check.
  it('publishes a union that is exactly its three domains', () => {
    expect([...CAPABILITY_TRAITS].sort()).toEqual(
      [...PICTURE_TRAITS, ...MONTAGE_TRAITS, ...MATERIAL_TRAITS].sort(),
    )
  })
})
