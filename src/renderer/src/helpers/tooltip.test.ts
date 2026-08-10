import { describe, expect, it } from 'vitest'
import {
  tipFor,
  HINT_LEFT,
  HINT_TOP,
  TIP_BOTTOM,
  TIP_RIGHT,
  TIP_TOP,
  TOOLTIP_ID,
  withShortcut,
} from './tooltip'

// The fixtures below are invented, not taken from the i18n bundle: this module never translates
// anything, so they stay English like the rest of `src/`.
describe('tooltip attributes', () => {
  it('names the shared tooltip so one host serves every control', () => {
    expect(TIP_TOP('Brush')['data-tooltip-id']).toBe(TOOLTIP_ID)
  })

  it('carries the placement it was built for', () => {
    expect(TIP_TOP('Brush')['data-tooltip-place']).toBe('top')
    expect(TIP_BOTTOM('Brush')['data-tooltip-place']).toBe('bottom')
  })

  it('tips the label itself when nothing explains it', () => {
    const attributes = TIP_TOP('Brush', 'B')

    expect(attributes['aria-label']).toBe('Brush (B)')
    expect(attributes['data-tooltip-content']).toBe('Brush (B)')
  })

  it('keeps the accessible name terse when a description is given', () => {
    const attributes = TIP_TOP('Hardness', undefined, 'Sharpness of the brush edge')

    expect(attributes['aria-label']).toBe('Hardness')
    expect(attributes['data-tooltip-content']).toBe('Sharpness of the brush edge')
  })

  it('still shows the shortcut on a described control', () => {
    // The shortcut is the half nobody can guess: an explained tool must not lose it.
    const attributes = TIP_TOP('Brush', 'B', 'Paint with the current colour')

    expect(attributes['data-tooltip-content']).toBe('Paint with the current colour (B)')
  })
})

/**
 * The counterpart of `TIP_*`, for a control whose name is already on screen. The whole point is
 * the attribute it does NOT set: an `aria-label` over a visible label replaces it for a screen
 * reader (WCAG SC 2.5.3), so the button would answer to a name nobody can see.
 */
describe('hint attributes', () => {
  it('never renames the control it explains', () => {
    const attributes = HINT_TOP('Asks the account for the figures again')

    expect(attributes['aria-label']).toBeUndefined()
    expect(attributes['data-tooltip-content']).toBe('Asks the account for the figures again')
  })

  it('reaches the same shared host, at the placement it was built for', () => {
    expect(HINT_LEFT('Anything')['data-tooltip-id']).toBe(TOOLTIP_ID)
    expect(HINT_LEFT('Anything')['data-tooltip-place']).toBe('left')
  })
})

describe('withShortcut', () => {
  it('leaves the label alone when there is no shortcut', () => {
    expect(withShortcut('Brush')).toBe('Brush')
    expect(withShortcut('Brush', false)).toBe('Brush')
  })
})

describe('tipFor', () => {
  it('sends a vertical bar’s tooltips to the side, away from its own buttons', () => {
    expect(tipFor('vertical')).toBe(TIP_RIGHT)
    expect(tipFor('horizontal')).toBe(TIP_TOP)
  })

  it('sends a horizontal bar’s flyout rows below it, clear of the bar itself', () => {
    expect(tipFor('horizontal', 'flyout')).toBe(TIP_BOTTOM)
  })
})
