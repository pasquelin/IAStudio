import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_HOME_SECTIONS } from '@shared/domain/home'
import { useSettings } from '@/stores/settings'
import { SectionMenu } from './SectionMenu'

/** French takes a no-break space before a semicolon, and eslint refuses the character itself. */
const NBSP = ' '

const openMenu = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Personnaliser cette section' }))
}

beforeEach(() => {
  useSettings.setState(state => ({
    auth: { authenticated: true },
    settings: {
      ...state.settings,
      home: { enabled: true, sections: [...DEFAULT_HOME_SECTIONS] },
    },
  }))
})

describe('SectionMenu', () => {
  // `favorites` is the section that offers all four rows: it can move, it can be hidden, and it
  // carries a default limit.
  it('explains every row instead of reading its label back', async () => {
    render(<SectionMenu id="favorites" />)
    await openMenu()

    const said = (name: string): string | null =>
      screen.getByRole('menuitem', { name }).getAttribute('data-tooltip-content')

    expect(said('Monter')).toBe('Remonte cette section d’un cran sur l’accueil')
    expect(said('Descendre')).toBe('Descend cette section d’un cran sur l’accueil')
    expect(said('Masquer cette section')).toBe(
      `Retire la section de l’accueil${NBSP}; une ligne en bas de la page la rétablit`,
    )
    expect(screen.getByRole('menuitemradio', { name: 'Afficher 12 éléments' })).toHaveAttribute(
      'data-tooltip-content',
      'Ne garde que 12 éléments dans cette section',
    )
  })

  it('leaves the visible labels to answer for themselves', async () => {
    render(<SectionMenu id="favorites" />)
    await openMenu()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3). Both
    // roles: a ticked row is a `menuitemradio` and `getAllByRole('menuitem')` walks past it.
    const rows = [...screen.getAllByRole('menuitem'), ...screen.getAllByRole('menuitemradio')]
    expect(rows).toHaveLength(7)
    for (const row of rows) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })
})
