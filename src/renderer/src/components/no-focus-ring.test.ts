import { describe, expect, it } from 'vitest'
import { stylesheet } from '../indexCss-fixtures'
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
    expect(stylesheet).toMatch(/:focus,[\s\S]*?:focus-within\s*\{\s*outline: none !important;/)
  })

  /**
   * `:focus-within` is not a second way of saying the same thing: daisyUI writes its field ring on
   * that selector alone, so the rule read as held while the windows built on its components — the
   * welcome's account form, first of them — drew the outline anyway.
   */
  it('covers the selector a component library reaches for, not only the bare one', () => {
    expect(stylesheet).toContain(':focus-within {')
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
