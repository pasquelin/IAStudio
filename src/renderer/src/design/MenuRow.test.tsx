import { mdiContentCopy } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { MenuRow } from './MenuRow'

const props = {
  label: 'Copy',
  icon: mdiContentCopy,
  tip: HINT_RIGHT('Puts a copy on the clipboard'),
  onSelect: () => undefined,
}

describe('one row of a menu', () => {
  it('is a plain item when it answers no question', () => {
    render(<MenuRow {...props} />)

    const row = screen.getByRole('menuitem', { name: 'Copy' })
    expect(row).not.toHaveAttribute('aria-checked')
  })

  /**
   * `aria-checked` is not allowed on a plain `menuitem` — a row that drew the tick and kept the
   * role announced nothing at all, which is what every menu of the studio used to do.
   */
  it('is a radio when the tick means one of several', () => {
    render(<MenuRow {...props} checked tick="one-of" />)

    expect(screen.getByRole('menuitemradio', { name: 'Copy' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  // The layer padlocks: any number of them can be on at once, and announcing them as
  // alternatives would tell a reader that arming one disarms the others.
  it('is a checkbox when the tick means this row on its own', () => {
    render(<MenuRow {...props} checked tick="on-off" />)

    expect(screen.getByRole('menuitemcheckbox', { name: 'Copy' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  // Unticked is not the same as untickable: the row still has to say which of the two it is.
  it('says it is not ticked rather than saying nothing', () => {
    render(<MenuRow {...props} checked={false} tick="one-of" />)

    expect(screen.getByRole('menuitemradio', { name: 'Copy' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  // `useMenuKeys` owns which row holds the single tab stop; a `tabIndex` written here would be
  // put back by React on every render.
  /**
   * Required rather than optional, on `ToolButton`'s pattern: it was optional over thirty-three
   * rows and thirty-two of them said nothing. A type is the only guard that catches the
   * thirty-fourth.
   */
  it('wears the tooltip attributes it is handed, and no accessible name of its own', () => {
    render(<MenuRow {...props} />)

    const row = screen.getByRole('menuitem', { name: 'Copy' })
    expect(row).toHaveAttribute('data-tooltip-content', 'Puts a copy on the clipboard')
    expect(row).toHaveAttribute('data-tooltip-place', 'right')
    expect(row).not.toHaveAttribute('aria-label')
  })

  it('leaves its place in the tab sequence to the menu', () => {
    render(<MenuRow {...props} />)

    expect(screen.getByRole('menuitem')).not.toHaveAttribute('tabindex')
  })

  /**
   * The contract widened for the journal's filters, guarded at home: a row whose meaning is
   * entirely in its tick carries no glyph, and the column stays anyway. Without it, a menu mixing
   * ticked rows with and without an icon steps its labels in and out by fourteen pixels — which
   * is what the first caller to leave one out did.
   */
  it('keeps the glyph column for a row that carries no icon', () => {
    const { container } = render(<MenuRow {...props} icon={undefined} />)

    expect(container.querySelectorAll('svg')).toHaveLength(0)
    expect(container.querySelectorAll('span.w-3\\.5')).toHaveLength(2)
  })

  // The other half, and the half a harness caught missing: emptying the column silently left
  // every row of every menu glyphless with the whole suite green.
  it('draws the glyph of a row that carries one', () => {
    const { container } = render(<MenuRow {...props} />)

    expect(container.querySelectorAll('svg')).toHaveLength(1)
  })

  /**
   * The height and `shrink-0` are one statement, and jsdom lays nothing out so only the pair is
   * visible here: a row is a flex item of a column that stops at `max-h-[min(60vh,32rem)]`
   * (`Flyout`), where the default `flex-shrink: 1` spends the overflow on its children. The font
   * menu's 271 rows measured 16.5px each — the gauge says 28 — and every menu long enough to
   * scroll was drawing rows a third shorter than the rest of the studio's controls.
   */
  it('keeps its gauge height in a menu that has more rows than room', () => {
    render(<MenuRow {...props} />)

    const row = screen.getByRole('menuitem', { name: 'Copy' })
    expect(row).toHaveClass('h-(--sc-control)')
    expect(row).toHaveClass('shrink-0')
  })
})
