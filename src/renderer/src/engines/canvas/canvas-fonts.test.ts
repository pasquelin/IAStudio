import { describe, expect, it } from 'vitest'
import { DEFAULT_FONT, type FontRef } from '@shared/domain/font'
import {
  DEFAULT_CANVAS,
  groupLayer,
  pixelLayer,
  textLayer,
  type CanvasState,
  type Layer,
} from './canvas-state'
import { captionsSetIn, faceUrlOf, familyStack } from './canvas-fonts'

describe('the stack a caption is drawn with', () => {
  // A family name is a sentence: "IBM Plex Serif" unquoted reads as three names.
  it('quotes the family, so a name of several words stays one', () => {
    expect(familyStack({ source: 'embedded', family: 'IBM Plex Serif' })).toBe(
      '"IBM Plex Serif", sans-serif',
    )
  })

  // What draws while an embedded face is still being registered, and for good on a machine that
  // has not got a system one.
  it('always ends on a generic, so something is drawn whatever happens', () => {
    expect(familyStack({ source: 'system', family: 'Futura' })).toMatch(/, sans-serif$/)
  })

  // The family is read out of a font file the studio did not write: one holding a quote would
  // close the declaration and take the generic down with it.
  it('escapes a quote in a family name rather than letting it close the declaration', () => {
    expect(familyStack({ source: 'system', family: 'He said "hi"' })).toBe(
      '"He said \\"hi\\"", sans-serif',
    )
  })
})

describe('the file a face has to be registered from', () => {
  it('points at the studio’s own folder for a face it ships', () => {
    expect(faceUrlOf(DEFAULT_FONT)).toBe('./fonts/Lato-Regular.ttf')
  })

  // Nothing to register: the browser already resolves an installed family by name.
  it('asks for nothing for a face the machine has installed', () => {
    expect(faceUrlOf({ source: 'system', family: 'Futura' })).toBeNull()
  })

  it('asks for nothing for a family the studio no longer ships', () => {
    const gone: FontRef = { source: 'embedded', family: 'Helvetiker' }

    expect(faceUrlOf(gone)).toBeNull()
  })
})

/**
 * A face lands long after the caption that asked for it. What the document holds by then is what
 * decides — never what asked.
 */
describe('the captions a landed face is still worth redrawing', () => {
  const caption = textLayer('t', 'Hello', { x: 0, y: 0 })
  const landed = DEFAULT_FONT.family
  const holding = (...layers: Layer[]): CanvasState => ({ ...DEFAULT_CANVAS, layers })

  it('are the ones still set in that face', () => {
    expect(captionsSetIn(holding(caption), landed)).toEqual([caption])
  })

  // The face is fetched once for the family, so every caption set in it is waiting on that one
  // file. Redrawing only the one that asked left the others in the generic for good.
  it('are all of them, not the one that asked', () => {
    const other = textLayer('u', 'Goodbye', { x: 0, y: 40 })

    expect(captionsSetIn(holding(caption, other), landed)).toEqual([caption, other])
  })

  // Groups nest, so `layers` is only the root of the stack. A caption filed in one is drawn like
  // any other, and a face landing for it has to find it.
  it('are found however deep they are filed', () => {
    const filed = groupLayer('outer', 'Titles', [groupLayer('inner', 'Captions', [caption])])

    expect(captionsSetIn(holding(filed), landed)).toEqual([caption])
  })

  it('leave out a caption refaced while the file was on its way', () => {
    const futura: FontRef = { source: 'system', family: 'Futura' }
    const refaced = { ...textLayer('u', 'Goodbye', { x: 0, y: 40 }), font: futura }

    expect(captionsSetIn(holding(caption, refaced), landed)).toEqual([caption])
  })

  it('are none when every caption was deleted while the file was on its way', () => {
    expect(captionsSetIn(holding(), landed)).toEqual([])
  })

  // The engine holds no document at all until one is applied, and a face can land in between.
  it('are none when there is no document to look in', () => {
    expect(captionsSetIn(null, landed)).toEqual([])
  })

  // A pixel layer has no words to draw, and nothing to read a family off.
  it('leave out what is not a caption', () => {
    expect(captionsSetIn(holding(pixelLayer('t', 'Background')), landed)).toEqual([])
  })
})
