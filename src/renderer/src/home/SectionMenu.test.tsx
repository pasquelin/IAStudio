import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { DEFAULT_HOME_SECTIONS } from '@shared/domain/home'
import { useSettings } from '@/stores/settings'
import { SectionMenu } from './SectionMenu'

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
  // `explore` is the section that still has something to offer: it is anchored, so neither move
  // is allowed, but it can be hidden.
  it('explains every row instead of reading its label back', async () => {
    render(<SectionMenu id="explore" />)
    await openMenu()

    const said = (name: string): string | null =>
      screen.getByRole('menuitem', { name }).getAttribute('data-tooltip-content')

    expect(said('Monter')).toBe('Remonte cette section d’un cran sur l’accueil')
    expect(said('Descendre')).toBe('Descend cette section d’un cran sur l’accueil')
    expect(said('Masquer cette section')).toBe(
      `Retire la section de l’accueil${NO_BREAK_SPACE}; une ligne en bas de la page la rétablit`,
    )
  })

  it('leaves the visible labels to answer for themselves', async () => {
    render(<SectionMenu id="explore" />)
    await openMenu()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    const rows = screen.getAllByRole('menuitem')
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })

  /**
   * A glyph that opens onto rows the section can only refuse is worse than no glyph: the reader
   * hovers a heading, finds a control, opens it, and every line is greyed out.
   */
  it('draws nothing at all for a section that can neither move nor be hidden', () => {
    const { container } = render(<SectionMenu id="spotlight" />)

    expect(container).toBeEmptyDOMElement()
  })
})
