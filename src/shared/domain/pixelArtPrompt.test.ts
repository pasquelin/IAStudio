import { describe, expect, it } from 'vitest'
import { PIXEL_ART_PROMPT_MAX, withPixelArtPrompt } from './pixelArtPrompt'

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

  it('stays inside the room it declares, at the largest grid a document can hold', () => {
    expect(withPixelArtPrompt('', 8192, 8192).length).toBeLessThanOrEqual(PIXEL_ART_PROMPT_MAX)
  })
})
