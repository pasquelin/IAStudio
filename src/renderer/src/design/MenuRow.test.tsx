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
})
