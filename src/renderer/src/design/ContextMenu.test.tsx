import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ContextMenu } from './ContextMenu'

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
