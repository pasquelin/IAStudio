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
const RING = /\b(?:focus|focus-visible|focus-within)[^\s'"`]*:(?:ring|outline)-(?!none)/

describe('no focus ring', () => {
  it('is stated once, in the stylesheet, where it also reaches daisyUI and Chromium', () => {
    expect(stylesheet).toMatch(/:focus-visible[^{]*\{\s*outline: none !important/)
  })

  it('is not written back one component at a time', () => {
    const offenders = WRITTEN_SOURCES.filter(([, source]) => RING.test(source)).map(
      ([path]) => path,
    )

    expect(offenders).toEqual([])
    // The rule refuses something, which a sweep that only ever returns nothing cannot show.
    expect(RING.test("'focus-visible:ring-accent'")).toBe(true)
    expect(RING.test("'focus:outline-2'")).toBe(true)
    expect(RING.test("'group-data-selected/row:focus-visible:ring-accent-content'")).toBe(true)
    // The drop target of the title bar draws a ring that no focus brings up.
    expect(RING.test("'ring-accent ring-2'")).toBe(false)
    expect(RING.test("'focus-visible:bg-accent'")).toBe(false)
  })
})
