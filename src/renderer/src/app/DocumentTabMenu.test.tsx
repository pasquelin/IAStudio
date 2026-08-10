import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocumentTabMenu } from './DocumentTabMenu'

vi.mock('./close-tab', () => ({ closeTab: vi.fn() }))
vi.mock('./document-io', () => ({ closeDocument: vi.fn(), deleteDocument: vi.fn() }))
vi.mock('./dockview-api', () => ({ openPanelIds: () => ['a', 'b'] }))

/** French takes a no-break space before a semicolon, and eslint refuses the character itself. */
const NBSP = ' '

const open = (): void => {
  render(<DocumentTabMenu documentId="a" at={{ x: 10, y: 10 }} onClose={vi.fn()} />)
}

describe('DocumentTabMenu', () => {
  it('says what each row does to the document rather than to the tab alone', () => {
    open()

    const said = (name: string): string | null =>
      screen.getByRole('menuitem', { name }).getAttribute('data-tooltip-content')

    expect(said('Fermer l’onglet')).toBe(
      `Retire l’onglet de la barre${NBSP}; le document reste dans le projet`,
    )
    expect(said('Fermer les autres onglets')).toBe('Ferme tous les autres onglets, un par un')
    expect(said('Supprimer le document…')).toBe('Retire le document du projet, son fichier compris')
  })

  it('leaves the visible labels to answer for themselves', () => {
    open()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    for (const row of screen.getAllByRole('menuitem')) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })
})
