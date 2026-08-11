import { mdiPencil } from '@mdi/js'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TIP_TOP } from '@/helpers/tooltip'
import { MenuButton, type MenuButtonProps } from './MenuButton'

function bar(props: Partial<MenuButtonProps> = {}) {
  render(menu(props))
  return screen.getByRole('button', { name: 'Brush' })
}

function menu(props: Partial<MenuButtonProps> = {}) {
  return (
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
    />
  )
}

const row = (name: string): HTMLElement => screen.getByRole('menuitem', { name })

/** Appended by hand, so `cleanup` knows nothing about them: they would pile up across tests. */
const planted: HTMLElement[] = []
const plant = <T extends HTMLElement>(node: T): T => {
  document.body.appendChild(node)
  planted.push(node)
  return node
}

afterEach(() => {
  for (const node of planted.splice(0)) node.remove()
})

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

    /**
     * A mode group arms its tool on click, so its menu never opens that way — hovering was the
     * only opener, and no keyboard hovers. `Alt+ArrowDown` is the gesture APG names for it.
     */
    it('opens a group whose click arms a mode instead', async () => {
      const button = bar({ opensOnClick: false })
      button.focus()

      await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')

      expect(row('Pinceau')).toHaveFocus()
    })

    it('leaves Enter to arming the tool, which is what a click does there', async () => {
      const onClick = vi.fn()
      const button = bar({ opensOnClick: false, onClick })
      button.focus()

      await userEvent.keyboard('{Enter}')

      expect(onClick).toHaveBeenCalledOnce()
      expect(screen.queryByRole('menuitem', { name: 'Pinceau' })).not.toBeInTheDocument()
    })

    /** The bare arrow belongs to whoever walks the bar; taking it would trade one gesture away. */
    it('ignores the arrow without Alt', async () => {
      const button = bar({ opensOnClick: false })
      button.focus()

      await userEvent.keyboard('{ArrowDown}')

      expect(screen.queryByRole('menuitem', { name: 'Pinceau' })).not.toBeInTheDocument()
    })

    /**
     * The chord belongs to the button: these sit inside `Collection` cells, which walk the list
     * on a bare `ArrowDown` without reading the modifiers. Bubbling, one press opened the menu
     * and moved the focus a row on, leaving the menu anchored where nobody was.
     */
    it('keeps the chord from the surface it sits in', async () => {
      const reached: string[] = []
      render(
        <div onKeyDown={event => reached.push(event.key)}>{menu({ opensOnClick: false })}</div>,
      )
      screen.getByRole('button', { name: 'Brush' }).focus()

      await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')

      expect(row('Pinceau')).toBeInTheDocument()
      expect(reached).not.toContain('ArrowDown')
    })

    it('leaves a chord carrying a fourth modifier alone', async () => {
      const button = bar({ opensOnClick: false })
      button.focus()

      await userEvent.keyboard('{Shift>}{Alt>}{ArrowDown}{/Alt}{/Shift}')

      expect(screen.queryByRole('menuitem', { name: 'Pinceau' })).not.toBeInTheDocument()
    })

    /**
     * `ask` sets its state whether or not there is anything to show, and `showing` reads the row
     * count only at render. Without the guard the press is remembered, and the menu springs open
     * by itself the moment a row appears — a shape no caller produces today, and the reason the
     * guard is not left to `showing` to compensate for.
     */
    it('does not remember a press made while there was no menu', async () => {
      const { rerender } = render(menu({ rowCount: 1, opensOnClick: false }))
      screen.getByRole('button', { name: 'Brush' }).focus()

      await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
      rerender(menu({ rowCount: 2, opensOnClick: false }))

      expect(screen.queryByRole('menuitem', { name: 'Pinceau' })).not.toBeInTheDocument()
    })

    /** Alt+Down scrolls, and on macOS pages down: the chord this button takes is its own. */
    it('stops the browser acting on the chord it takes', () => {
      const button = bar({ opensOnClick: false })

      expect(fireEvent.keyDown(button, { key: 'ArrowDown', altKey: true })).toBe(false)
    })

    it('leaves the focus alone when the pointer merely crossed the bar', async () => {
      const typing = plant(document.createElement('input'))
      typing.focus()

      await userEvent.hover(bar())

      expect(row('Pinceau')).toBeInTheDocument()
      expect(typing).toHaveFocus()
    })

    it('closes on Escape, asked for or merely hovered into', async () => {
      await userEvent.hover(bar())

      await userEvent.keyboard('{Escape}')

      expect(screen.queryByRole('menuitem', { name: 'Pinceau' })).not.toBeInTheDocument()
    })

    it('closes on Tab, and hands the focus back to the button it came from', async () => {
      const button = bar()
      await userEvent.click(button)

      await userEvent.keyboard('{Tab}')

      expect(screen.queryByRole('menuitem', { name: 'Pinceau' })).not.toBeInTheDocument()
      expect(button).toHaveFocus()
    })

    /**
     * One caller's flyout holds sliders rather than rows. The walk installs all the same and
     * finds nothing to walk: the focus stays on the button, and `Tab` walks on into the panel
     * rather than closing it — which is what a panel of sliders owes a keyboard.
     */
    it('leaves a flyout of sliders to the ordinary tab order', async () => {
      const button = bar({
        menu: false,
        rows: () => <input type="range" aria-label="Size" />,
      })
      await userEvent.click(button)
      expect(button).toHaveFocus()

      await userEvent.keyboard('{Tab}')

      expect(screen.getByLabelText('Size')).toHaveFocus()
    })

    // A pointer wandering off the bar must not end a walk the keyboard is holding.
    it('survives the pointer leaving the bar', async () => {
      const button = bar()
      await userEvent.click(button)

      await userEvent.unhover(button)

      expect(row('Pinceau')).toBeInTheDocument()
    })
  })
})
