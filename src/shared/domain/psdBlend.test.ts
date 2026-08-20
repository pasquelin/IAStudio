import { describe, expect, it } from 'vitest'
import { BLEND_MODES } from './canvasBlend'
import { blendFromPsd, composesInStudio, psdBlendOf } from './psdBlend'

describe('the studio operations as Photoshop spells them', () => {
  it('names every one of them, so none can be added without a spelling', () => {
    expect(BLEND_MODES.filter(blend => !psdBlendOf(blend))).toEqual([])
  })

  /** The whole difference is punctuation, and it is the half a replace would have got right. */
  it('spaces what the studio hyphenates', () => {
    expect(psdBlendOf('color-dodge')).toBe('color dodge')
    expect(psdBlendOf('soft-light')).toBe('soft light')
    expect(psdBlendOf('multiply')).toBe('multiply')
  })

  it('reads each of its own spellings back to the operation it came from', () => {
    for (const blend of BLEND_MODES) {
      expect(blendFromPsd(psdBlendOf(blend))).toBe(blend)
    }
  })

  /**
   * The other half a replace would have got WRONG: Photoshop has nineteen operations this studio
   * composes none of, and `vivid light` reads as `vivid-light` — a mode nothing here can draw.
   */
  it('falls back to plain for an operation the studio has no answer for', () => {
    expect(blendFromPsd('vivid light')).toBe('normal')
    expect(blendFromPsd('dissolve')).toBe('normal')
    expect(blendFromPsd(undefined)).toBe('normal')
  })

  /** Falling back is a LOSS, and this is what lets the import say so rather than hide it. */
  it('tells a fallback apart from a mode it truly holds', () => {
    expect(composesInStudio('multiply')).toBe(true)
    expect(composesInStudio('normal')).toBe(true)
    expect(composesInStudio('vivid light')).toBe(false)
    expect(composesInStudio(undefined)).toBe(false)
  })
})
