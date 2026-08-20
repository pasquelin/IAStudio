import { mdiContentCopy, mdiContentCut } from '@mdi/js'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { HINT_RIGHT } from '@/helpers/tooltip'
import type { ContextMenuAt } from '@/hooks/useContextMenu'
import { ContextMenu } from './ContextMenu'
import { MenuRow } from './MenuRow'

const AT = { x: 40, y: 60 }

function open(at = AT, onClose = vi.fn()) {
  render(
    <ContextMenu at={at} onClose={onClose}>
      <button type="button">Place as a layer</button>
    </ContextMenu>,
  )
  return { menu: screen.getByRole('menu'), onClose }
}

describe('a menu at the pointer', () => {
  it('opens where the pointer was', () => {
    const { menu } = open()

    expect(menu.style.left).toBe('40px')
    expect(menu.style.top).toBe('60px')
  })

  // A menu opened near an edge would otherwise draw half of itself outside the window, and the
  // rows past it are unreachable.
  it('keeps itself off the window edges', () => {
    const { menu } = open({ x: window.innerWidth + 200, y: window.innerHeight + 200 })

    expect(Number.parseInt(menu.style.left, 10)).toBeLessThan(window.innerWidth)
    expect(Number.parseInt(menu.style.top, 10)).toBeLessThan(window.innerHeight)
  })

  it('closes on a press outside it', () => {
    const { onClose } = open()

    fireEvent.pointerDown(document.body)

    expect(onClose).toHaveBeenCalled()
  })

  // A row closes the menu itself, once it has acted: dismissing on the way down would take the
  // menu out from under the pointer before the row ever heard the click.
  it('stays open for a press on one of its own rows', () => {
    const { onClose } = open()

    fireEvent.pointerDown(screen.getByRole('button'))

    expect(onClose).not.toHaveBeenCalled()
  })

  /**
   * The portal moves the menu in the DOM and NOT in the React tree, which is the tree React
   * bubbles synthetic events through. So a menu raised over a row of a list is still, to React,
   * inside that row — and the list it sits in opens what a single click lands on.
   */
  describe('kept apart from what it was raised over', () => {
    function Host({ spy }: { spy: (kind: string) => void }) {
      const [at, setAt] = useState<ContextMenuAt | null>(null)

      return (
        <div
          onClick={() => spy('click')}
          onPointerDown={() => spy('pointerdown')}
          onContextMenu={event => {
            event.preventDefault()
            spy('contextmenu')
            setAt({ x: event.clientX, y: event.clientY })
          }}
        >
          <button type="button">The row underneath</button>
          {at && (
            <ContextMenu at={at} onClose={vi.fn()}>
              <MenuRow
                label="Remove from the list"
                icon={mdiContentCut}
                tip={HINT_RIGHT('Takes the row off the shelf')}
                onSelect={() => undefined}
              />
            </ContextMenu>
          )}
        </div>
      )
    }

    const raise = (spy: (kind: string) => void): HTMLElement => {
      render(<Host spy={spy} />)
      fireEvent.contextMenu(screen.getByRole('button', { name: 'The row underneath' }))
      return screen.getByRole('menuitem', { name: 'Remove from the list' })
    }

    it('does not press what lies under it when a row is chosen', async () => {
      const spy = vi.fn()
      const row = raise(spy)
      spy.mockClear()

      await userEvent.click(row)

      expect(spy).not.toHaveBeenCalled()
    })

    // Right-clicking an open menu is how one tries to dismiss it. Left to bubble, the host takes
    // it for a fresh right-click and re-anchors the menu under the pointer instead.
    it('does not re-open itself on a right-click inside it', () => {
      const spy = vi.fn()
      const row = raise(spy)
      spy.mockClear()

      fireEvent.contextMenu(row)

      expect(spy).not.toHaveBeenCalled()
    })
  })

  it('closes on Escape', () => {
    const { onClose } = open()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  // The window losing focus means something else is in front; a menu left hanging over it
  // belongs to a surface the user is no longer looking at.
  it('closes when the window loses focus', () => {
    const { onClose } = open()

    fireEvent.blur(window)

    expect(onClose).toHaveBeenCalled()
  })

  it('lets go of its listeners when it goes', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <ContextMenu at={AT} onClose={onClose}>
        <span>row</span>
      </ContextMenu>,
    )

    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(document.body)

    expect(onClose).not.toHaveBeenCalled()
  })

  /**
   * The menu portals to the end of `body`, so before this the only way to reach it from the
   * keyboard was to tab through the whole document. The walk itself belongs to `useMenuKeys`
   * and is measured there; what this proves is that the menu asks for it.
   */
  describe('taken from the keyboard', () => {
    function Host({ onClose }: { onClose: () => void }) {
      return (
        <ContextMenu at={AT} onClose={onClose}>
          <MenuRow
            label="Cut"
            icon={mdiContentCut}
            tip={HINT_RIGHT('Takes it away and keeps a copy')}
            onSelect={() => undefined}
          />
          <MenuRow
            label="Copy"
            icon={mdiContentCopy}
            tip={HINT_RIGHT('Leaves it where it is and keeps a copy')}
            onSelect={() => undefined}
          />
        </ContextMenu>
      )
    }

    it('puts focus on its first row as it opens', () => {
      render(<Host onClose={vi.fn()} />)

      expect(screen.getByRole('menuitem', { name: 'Cut' })).toHaveFocus()
    })

    it('walks its rows with the arrows', async () => {
      render(<Host onClose={vi.fn()} />)

      await userEvent.keyboard('{ArrowDown}')

      expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus()
    })

    // Closed from the keyboard, focus must not be left on `body`: the next `Tab` would then
    // start again from the top of the document.
    it('hands focus back to what opened it', async () => {
      function Opened() {
        const [open, setOpen] = useState(false)
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Open
            </button>
            {open && <Host onClose={() => setOpen(false)} />}
          </>
        )
      }

      render(<Opened />)
      const opener = screen.getByRole('button', { name: 'Open' })
      await userEvent.click(opener)
      expect(screen.getByRole('menuitem', { name: 'Cut' })).toHaveFocus()

      await userEvent.keyboard('{Escape}')

      expect(opener).toHaveFocus()
    })
  })

  // Drawn into the document root: a menu rendered inside a panel is clipped by that panel's
  // own overflow, which is what hid the last rows of the longer ones.
  it('draws outside the tree it was opened from', () => {
    const { container } = render(
      <ContextMenu at={AT} onClose={vi.fn()}>
        <span>row</span>
      </ContextMenu>,
    )

    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull()
  })
})
