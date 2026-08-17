import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WindowNav, WindowNavItem } from './WindowNav'
import { WRITTEN_SOURCES } from './test-harness'

/** As `WRITTEN_SOURCES` keys it: the glob resolves against `test-harness.ts`, its own neighbour. */
const CANONICAL = './WindowNav.tsx'

/** An opening `li`, then the skin, with no closing `li` in between. */
const ITEM_WEARING_SKIN = /<li[^>]*>(?:(?!<\/li>)[\s\S])*?windowControl\(/

const entry = (props: Partial<Parameters<typeof WindowNavItem>[0]> = {}) => (
  <WindowNav>
    <WindowNavItem active={false} hint="Opens the account settings" onSelect={() => {}} {...props}>
      Account
    </WindowNavItem>
  </WindowNav>
)

describe('WindowNavItem', () => {
  it('says which entry the pane is showing, and says nothing on the others', () => {
    const { rerender } = render(entry({ active: true }))
    expect(screen.getByRole('button', { name: 'Account' })).toHaveAttribute('aria-current', 'page')

    rerender(entry())
    expect(screen.getByRole('button', { name: 'Account' })).not.toHaveAttribute('aria-current')
  })

  /**
   * The words are on screen, so the hint explains instead of repeating them — and an `aria-label`
   * set over a visible label replaces it for a screen reader (WCAG SC 2.5.3).
   */
  it('explains through the tooltip without renaming the entry', () => {
    render(entry())

    const button = screen.getByRole('button', { name: 'Account' })
    expect(button).not.toHaveAttribute('aria-label')
    expect(button).toHaveAttribute('data-tooltip-content', 'Opens the account settings')
  })

  /**
   * The indent is a gauge and never a pixel, and a flat list must keep the left padding its own
   * caller gives it — which is what `undefined` buys, rather than a depth of zero.
   */
  it('indents by the gauge only where a tree says how deep it is', () => {
    const { rerender } = render(entry({ depth: 1 }))
    expect(screen.getByRole('button').style.paddingLeft).toBe('calc(var(--sc-indent) * 2)')

    rerender(entry())
    expect(screen.getByRole('button').style.paddingLeft).toBe('')
  })

  /**
   * The windows speak DaisyUI's tokens and the docks speak the studio's. An entry reaching for a
   * dock's skin would look like a panel control inside an ordinary window.
   */
  it('wears the window vocabulary, not the docks', () => {
    render(entry({ active: true }))

    expect(screen.getByRole('button')).toHaveClass('bg-primary')
  })
})

describe('WindowNav', () => {
  /**
   * The list scrolls, not the column: a window pins a search field above it and a refresh under
   * it, and both have to stay put once the list runs past the window.
   */
  it('scrolls on its own so what a window pins around it stays put', () => {
    render(entry())

    const list = screen.getByRole('list')
    expect(list).toHaveClass('overflow-auto')
    expect(list).toHaveClass('min-h-0')
    expect(list).toHaveClass('flex-1')
  })

  /**
   * The shape the three copies each wrote: the window skin reached INSIDE a list item. Read as
   * an opening `li` with no closing one before the skin, rather than as the two words being in
   * the same file — a file is free to hold a list on one side and the skin on the other, which
   * `ManualWindow` does with its search results and `UsageWindow` with its refresh button.
   *
   * **What it cannot see**: a window reaching the skin through a variable, or one that hands the
   * `li` to a component of its own. Both are ways of writing it again on purpose; this catches
   * the shape the habit produces, which is the one that happened three times.
   */
  it('is the only place where a list item wears the window skin', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== CANONICAL && ITEM_WEARING_SKIN.test(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('reads the shape it means, and not a file that merely holds both words', () => {
    expect(ITEM_WEARING_SKIN.test('<li>\n<button className={windowControl(on)} />\n</li>')).toBe(
      true,
    )
    expect(ITEM_WEARING_SKIN.test('<li>{title}</li>\n<b className={windowControl(false)} />')).toBe(
      false,
    )
  })

  // The partner of the rule above: a rule nobody's code reaches is green on an empty studio.
  it('is worn by the three windows it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== CANONICAL && source.includes('WindowNavItem'),
    )

    expect(wearing.length).toBeGreaterThanOrEqual(3)
  })
})
