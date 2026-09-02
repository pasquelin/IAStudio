import { describe, expect, it } from 'vitest'
import { PIXEL_ART_PROMPT_MAX, pixelArtWords, withPixelArtPrompt } from './pixelArtPrompt'

describe('the pixel-art prompt', () => {
  it('says the grid after the subject, so what a model truncates is the tail', () => {
    expect(withPixelArtPrompt('a knight', 32, 32)).toBe(
      'a knight, pixel art, 32x32 sprite, hard edges, no anti-aliasing',
    )
  })

  /**
   * The catalogue keeps what was WRITTEN, and by then these words are part of it: a regeneration
   * would double them, then triple them, with nothing going red.
   */
  it('adds nothing to a prompt that already says pixel art', () => {
    const once = withPixelArtPrompt('a knight', 32, 32)

    expect(withPixelArtPrompt(once, 32, 32)).toBe(once)
    expect(withPixelArtPrompt('a PIXEL ART knight', 32, 32)).toBe('a PIXEL ART knight')
  })

  /**
   * 🛑 The WORD and not the substring: both of these carry « pixel art », and on the substring
   * the grid went nowhere while the box under the tick went on showing it.
   */
  it('is not fooled by a word that merely starts with it', () => {
    expect(withPixelArtPrompt('no pixel artifacts', 32, 32)).toContain('32x32 sprite')
    expect(withPixelArtPrompt('a pixel artist at work', 32, 32)).toContain('32x32 sprite')
  })

  /** The arbitration `bodyWithContext` already made: a style is a modifier, not a subject. */
  it('leaves a prompt nobody wrote alone, and trims the one somebody did', () => {
    expect(withPixelArtPrompt('   ', 32, 32)).toBe('   ')
    expect(withPixelArtPrompt('a knight ', 32, 32)).toBe(withPixelArtPrompt('a knight', 32, 32))
  })

  it('stays inside the room it declares, at the largest grid a document can hold', () => {
    expect(pixelArtWords(8192, 8192).length).toBeLessThanOrEqual(PIXEL_ART_PROMPT_MAX)
  })
})
