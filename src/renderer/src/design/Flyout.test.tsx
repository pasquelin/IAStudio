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
