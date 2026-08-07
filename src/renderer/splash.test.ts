import { describe, expect, it } from 'vitest'
import splash from './splash.html?raw'

/**
 * The splash cannot import the token layer: it is a separate Vite entry under a
 * `default-src 'none'` CSP, and pulling in the stylesheet would defeat its whole purpose.
 * Its palette is copied by hand, so it is pinned here — adding a colour to the page without
 * declaring it below fails, which is what keeps the drift visible.
 *
 * Values must match `src/renderer/src/index.css`; vitest returns an empty string for CSS
 * imports, so the comparison cannot be automated from here.
 */
const FROM_TOKENS = [
  { value: '#dfe1e5', token: '--color-text' },
  { value: '#868a91', token: '--color-muted' },
  { value: '#34363a', token: '--color-border' },
  { value: '#3574f0', token: '--color-accent' },
]

/** Mirrors build/icon.svg, so the splash and the Dock icon read as one object. */
const ICON_GRADIENT = ['#3b4256', '#22242a', '#191a1c']

describe('splash palette', () => {
  for (const { value, token } of FROM_TOKENS) {
    it(`still carries ${token}`, () => {
      expect(splash).toContain(value)
    })
  }

  it('introduces no colour beyond the tokens and the icon gradient', () => {
    const allowed = new Set([...ICON_GRADIENT, ...FROM_TOKENS.map(({ value }) => value)])
    const used = new Set(splash.match(/#[0-9a-fA-F]{6}\b/g) ?? [])

    expect([...used].filter(colour => !allowed.has(colour))).toEqual([])
  })
})
