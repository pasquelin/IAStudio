import { describe, expect, it } from 'vitest'
import stylesheet from '../index.css?raw'
import { WRITTEN_SOURCES } from './testHarness'

/**
 * The studio draws no focus ring — the owner's call, taken on 2026-08-15. What it costs is not
 * hidden: WCAG 2.4.7 asks for a visible focus indicator and there is none, so keyboard focus moves
 * with nothing on screen following it.
 *
 * The rule needs a guard because of HOW it was removed: `FOCUS_RING` used to be one constant, and
 * deleting it leaves twenty-six call sites that each look like a fine place to write the ring back
 * by hand. One component doing so is invisible in review — the ring only appears on Tab.
 *
 * A FILL is not a ring: `MenuRow` lights the focused row of a menu, which is how a keyboard walks
 * one at all, and this rule has nothing to say about it.
 */
describe('keyboard focus', () => {
  it('draws no browser outline on focused elements', () => {
    expect(stylesheet).toMatch(/:focus\s*\{\s*outline: none !important;/)
  })

  it('is not overridden one component at a time', () => {
    const overrides = /\b(?:focus|focus-visible|focus-within)[^\s'"`]*:outline-none/
    const offenders = WRITTEN_SOURCES.filter(([, source]) => overrides.test(source)).map(
      ([path]) => path,
    )

    expect(offenders).toEqual([])
    expect(overrides.test("'focus-visible:outline-none'")).toBe(true)
  })
})
