import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FONT,
  EMBEDDED_FONTS,
  embeddedFontOf,
  embeddedFontUrl,
  isSameFont,
  readFontRef,
} from './font'

describe('the embedded faces', () => {
  it('offers the default among them, so a default can never go missing', () => {
    expect(embeddedFontOf(DEFAULT_FONT.family)).not.toBeNull()
    expect(DEFAULT_FONT.source).toBe('embedded')
  })

  it('names each family once', () => {
    const families = EMBEDDED_FONTS.map(font => font.family)

    expect(new Set(families).size).toBe(families.length)
  })

  // The absolute path resolves against the drive root under `file://` in a packaged build —
  // the lesson the Draco and KTX2 decoders taught next door.
  it('asks for a face by a relative url, never an absolute one', () => {
    expect(embeddedFontUrl('Lato-Regular.ttf')).toBe('./fonts/Lato-Regular.ttf')
  })
})

describe('reading a typeface off a document', () => {
  it('keeps an embedded family the studio still ships', () => {
    expect(readFontRef({ source: 'embedded', family: 'IBM Plex Mono' })).toEqual({
      source: 'embedded',
      family: 'IBM Plex Mono',
    })
  })

  // Whatever the reader has installed: the studio cannot vouch for the name, and refusing it
  // here would drop a font that is perfectly present on the machine that wrote the document.
  it('keeps a system family whatever it is called', () => {
    expect(readFontRef({ source: 'system', family: 'Comic Sans MS' })).toEqual({
      source: 'system',
      family: 'Comic Sans MS',
    })
  })

  // Keeping the name would promise outlines nothing can produce, and the text would draw
  // nothing rather than draw plainly.
  it('falls back when an embedded family is one the studio no longer ships', () => {
    expect(readFontRef({ source: 'embedded', family: 'Helvetiker' })).toEqual(DEFAULT_FONT)
  })

  it.each([
    ['nothing at all', undefined],
    ['a value that is not a record', 'Lato'],
    ['a family that is not a string', { source: 'system', family: 12 }],
    ['an empty family', { source: 'system', family: '' }],
    ['a source the studio does not know', { source: 'cloud', family: 'Lato' }],
  ])('falls back on %s', (_case, value) => {
    expect(readFontRef(value)).toEqual(DEFAULT_FONT)
  })
})

describe('telling two typefaces apart', () => {
  it('separates the same family by where it comes from', () => {
    expect(
      isSameFont({ source: 'embedded', family: 'Lato' }, { source: 'system', family: 'Lato' }),
    ).toBe(false)
  })

  it('joins two references to the same face', () => {
    expect(isSameFont(DEFAULT_FONT, { source: 'embedded', family: 'Lato' })).toBe(true)
  })
})
