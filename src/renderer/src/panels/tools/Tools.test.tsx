import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { settleHome } from '@/home/home-fixtures'
import { useSettings } from '@/stores/settings'
import { Tools } from './Tools'

describe('Tools', () => {
  beforeEach(() => {
    settleHome()
    useSettings.setState({ settings: structuredClone(DEFAULT_SETTINGS) })
  })

  /**
   * The home draws the same spaces as the title bar. Reordering one of them alone would leave
   * two answers to "what comes first" on one screen, which is why both read the same hook.
   */
  it('follows the order the bar was dragged into', () => {
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, workspaces: { order: ['audio', 'image'] } },
    })

    render(<Tools />)

    const spaces = screen
      .getAllByRole('button')
      .map(button => button.textContent ?? '')
      .filter(label => label.startsWith('Audio') || label.startsWith('Image'))

    expect(spaces[0]?.startsWith('Audio')).toBe(true)
  })

  /**
   * The panel stands in a 320-pixel column, and Tailwind's breakpoints answer to the WINDOW: a
   * `sm:` or `lg:` grid here would cut that column in two on any screen wide enough to matter,
   * which is what the band it came from did on purpose.
   */
  it('lays its entries out in one column, whatever the window is', () => {
    const { container } = render(<Tools />)

    // Read off the attribute, not off `className`: on an `<svg>` that property is an
    // `SVGAnimatedString`, and a regular expression tested against it can never match.
    const classes = [...container.querySelectorAll('[class]')].map(
      node => node.getAttribute('class') ?? '',
    )

    // The anchor first: an empty panel would satisfy the assertion below on its own.
    expect(classes.some(value => value.includes('grid-cols'))).toBe(false)
    expect(classes.filter(value => /\b(sm|md|lg|xl):/.test(value))).toEqual([])
    expect(screen.getAllByRole('button').length).toBeGreaterThan(3)
  })

  // It is the one panel that says something on a machine with no key, no project and no history.
  it('offers a way in with nothing connected and no project open', () => {
    settleHome(null)
    render(<Tools />)

    expect(screen.getByRole('button', { name: /Nouveau projet/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Préférences/ })).toBeInTheDocument()
  })
})
