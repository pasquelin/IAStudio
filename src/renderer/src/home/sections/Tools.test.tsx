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
   * The band takes the centre, which is NOT the window: two columns of panels and two rails take
   * a third of it away without moving a breakpoint. So the grid tracks its own container —
   * `auto-fill` on a minimum — and a `sm:` or `lg:` rule here would count cells against a width
   * this band never has.
   *
   * The minimum is wrapped in `min(…, 100%)`, and that is the half a track floor gets wrong: the
   * centre is clamped at `MIN_CENTER` = 240 and `HomeView` hides its horizontal overflow, so a
   * bare `minmax(240px, …)` clips the tail of every entry instead of narrowing.
   */
  it('lays its entries out against the centre rather than against the window', () => {
    const { container } = render(<Tools />)

    // Read off the attribute, not off `className`: on an `<svg>` that property is an
    // `SVGAnimatedString`, and a regular expression tested against it can never match.
    const classes = [...container.querySelectorAll('[class]')].map(
      node => node.getAttribute('class') ?? '',
    )

    expect(classes.filter(value => /\b(sm|md|lg|xl):/.test(value))).toEqual([])

    // Both groups, and the anchor matters: an empty band would satisfy the rule above alone.
    const grids = classes.filter(value => value.includes('grid-cols-[repeat(auto-fill'))
    expect(grids).toHaveLength(2)
    for (const grid of grids) expect(grid).toContain('minmax(min(240px,100%),1fr)')
    expect(screen.getAllByRole('button').length).toBeGreaterThan(3)
  })

  /**
   * The tile wears the studio's one answer to "the pointer is here" rather than its own, and its
   * help is lifted with it: `muted` reads 3.51:1 on `elevated`, the fill the hover brings.
   *
   * Asserted on the class rather than on a rendered colour because jsdom computes no utility —
   * what a test can hold here is that the tile opens the group and the help reads from it.
   */
  it('lights up like a list row, and lifts its help with it', () => {
    render(<Tools />)

    const tile = screen.getAllByRole('button')[0]
    expect(tile).toHaveClass('group/row', 'hover:bg-elevated')

    // The radius `rowSkin` brings is the one a LINE takes; a tile of the home is wider and keeps
    // its own. Held because two arbitrary `rounded-(…)` would coexist if `twMerge` read them as
    // two groups, and the tile would then carry both.
    expect(tile).toHaveClass('rounded-(--radius-sc-md)')
    expect(tile).not.toHaveClass('rounded-(--radius-sc-sm)')

    // The fill fades and the words with it: `transition-colors` is on the tile AND on the help,
    // the property not being inherited. Held on both, or one of the two snaps.
    expect(tile).toHaveClass('transition-colors')

    // By the clamp and not by `.text-muted`: the icon wears that too, and it is drawn first.
    const help = tile?.querySelector('.line-clamp-2')
    expect(help).toHaveClass('text-muted', 'group-hover/row:text-text', 'transition-colors')
  })

  // It is the one band that says something on a machine with no key, no project and no history.
  it('offers a way in with nothing connected and no project open', () => {
    settleHome(null)
    render(<Tools />)

    expect(screen.getByRole('button', { name: /Nouveau projet/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Préférences/ })).toBeInTheDocument()
  })
})
