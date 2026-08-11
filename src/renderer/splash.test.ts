import { describe, expect, it } from 'vitest'
import stylesheet from './src/index.css?raw'
import splash from './splash.html?raw'

/**
 * The splash cannot import the token layer: it is a separate Vite entry under a
 * `default-src 'none'` CSP, and pulling in the stylesheet would defeat its whole purpose.
 * Its palette is copied by hand, so it is pinned here — adding a colour to the page without
 * declaring it below fails, which is what keeps the drift visible.
 *
 * The copies are compared to the sheet rather than trusted: this file used to state that the
 * comparison could not be automated, and it was written before the sheet was ever read as text.
 * It could, and the day the muted grey was raised for contrast the splash kept the old one.
 */
const FROM_TOKENS = [
  { value: '#dfe1e5', token: '--color-text' },
  { value: '#91959b', token: '--color-muted' },
  { value: '#34363a', token: '--color-border' },
  { value: '#3574f0', token: '--color-accent' },
]

function reference(): string {
  const [block = ''] = stylesheet.slice(stylesheet.indexOf('@theme {')).split('\n}')

  return block
}

/** Mirrors build/icon.svg, so the splash and the Dock icon read as one object. */
const ICON_GRADIENT = ['#3b4256', '#22242a', '#191a1c']

describe('splash palette', () => {
  for (const { value, token } of FROM_TOKENS) {
    it(`still carries ${token}`, () => {
      expect(splash).toContain(value)
    })

    // The `@theme` block alone, which holds the dark reference: `--color-accent` is restated
    // with the same value in two daisyUI blocks, so a search of the whole sheet would still find
    // the old one after the reference had moved on.
    it(`copies what ${token} is worth today`, () => {
      expect(reference()).toContain(`${token}: ${value};`)
    })
  }

  it('introduces no colour beyond the tokens and the icon gradient', () => {
    const allowed = new Set([...ICON_GRADIENT, ...FROM_TOKENS.map(({ value }) => value)])
    const used = new Set(splash.match(/#[0-9a-fA-F]{6}\b/g) ?? [])

    expect([...used].filter(colour => !allowed.has(colour))).toEqual([])
  })
})
