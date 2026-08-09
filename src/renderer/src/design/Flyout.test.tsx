import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Flyout } from './Flyout'

describe('Flyout', () => {
  it('renders its rows outside the anchor, at the document root', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)

    render(
      <Flyout anchor={anchor}>
        <button type="button">Pinceau</button>
      </Flyout>,
    )

    const row = screen.getByRole('button', { name: 'Pinceau' })
    // Rendered inside the bar it would be clipped by its rounded, overflowing edge.
    expect(anchor.contains(row)).toBe(false)
  })

  it('renders nothing without an anchor', () => {
    render(
      <Flyout anchor={null}>
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(screen.queryByRole('button', { name: 'Pinceau' })).not.toBeInTheDocument()
  })

  /**
   * The anchor's box, which jsdom reports as zeros. `offsetWidth` comes from the layout polyfill
   * in `test-setup`, which answers 640 for every element — so the menu is 640 wide here.
   */
  function anchorAt(left: number, right: number): HTMLElement {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    anchor.getBoundingClientRect = () =>
      ({ top: 10, bottom: 30, left, right, width: right - left, height: 20 }) as DOMRect
    return anchor
  }

  function menuLeft(): string {
    return screen.getByRole('menu').style.left
  }

  it('hangs beside its anchor when there is room', () => {
    render(
      <Flyout anchor={anchorAt(80, 100)}>
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(menuLeft()).toBe('102px')
  })

  it('flips to the other side rather than drawing itself off the window', () => {
    // A section heading reaches the very right edge: hung to the right, its rows sit outside the
    // window and cannot be reached at all.
    render(
      <Flyout anchor={anchorAt(1000, 1020)}>
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(menuLeft()).toBe(`${1000 - 640 - 2}px`)
  })

  it('exposes itself as a menu', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)

    render(
      <Flyout anchor={anchor}>
        <button type="button">Pinceau</button>
      </Flyout>,
    )
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})
