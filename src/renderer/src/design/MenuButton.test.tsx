import { mdiPencil } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TIP_TOP } from '@/helpers/tooltip'
import { MenuButton, type MenuButtonProps } from './MenuButton'

function bar(props: Partial<MenuButtonProps> = {}) {
  render(
    <MenuButton
      icon={mdiPencil}
      label="Brush"
      tooltip={TIP_TOP}
      rowCount={2}
      opensOnClick
      rows={() => (
        <>
          <button type="button" role="menuitem">
            Pinceau
          </button>
          <button type="button" role="menuitem">
            Gomme
          </button>
        </>
      )}
      {...props}
    />,
  )
  return screen.getByRole('button', { name: 'Brush' })
}

const row = (name: string): HTMLElement => screen.getByRole('menuitem', { name })

describe('MenuButton', () => {
  it('opens its rows on a click', async () => {
    await userEvent.click(bar())

    expect(row('Pinceau')).toBeInTheDocument()
  })

  /**
   * The two halves of the rule the toolbar lives by. A mode group's menu opens under the pointer
   * as it crosses the bar; taking the focus there pulls the caret out of whatever was being
   * typed, and hands it back to a button the user never meant to press.
   */
  describe('the keyboard', () => {
    it('takes the focus when the menu was asked for', async () => {
      await userEvent.click(bar())

      expect(row('Pinceau')).toHaveFocus()
    })

    it('walks the rows from there', async () => {
      await userEvent.click(bar())

      await userEvent.keyboard('{ArrowDown}')

      expect(row('Gomme')).toHaveFocus()
    })

    it('leaves the focus alone when the pointer merely crossed the bar', async () => {
      const typing = document.createElement('input')
      document.body.appendChild(typing)
      typing.focus()

      await userEvent.hover(bar())

      expect(row('Pinceau')).toBeInTheDocument()
      expect(typing).toHaveFocus()
    })

    /**
     * One caller's flyout holds sliders rather than rows. `useMenuKeys` finds its rows by their
     * role, so the arrows would find none — and the focus would be taken for nothing.
     */
    it('stays out of a flyout whose contents are not rows', async () => {
      const button = bar({
        menu: false,
        rows: () => <input type="range" aria-label="Size" />,
      })

      await userEvent.click(button)

      expect(button).toHaveFocus()
    })
  })
})
