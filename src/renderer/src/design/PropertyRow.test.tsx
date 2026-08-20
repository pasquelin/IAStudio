import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PropertyRow } from './PropertyRow'

/**
 * The label column is eighty pixels wide and truncates, which is a decision about alignment
 * rather than about language — but the two meet: `Repeat preview` fits it and `Aperçu de la
 * répétition` does not, so the same inspector was readable in English and cut in French, with
 * nothing to hover for the rest.
 */
describe('a property label too long for its column', () => {
  /**
   * The `title` sits on the COLUMN rather than on the word since the column gained an edge: a box
   * that stretches to its row cannot also be the box that truncates, so `PropertyLabel` is two
   * elements now. Hovering either still raises it, the attribute being inherited by the pointer.
   */
  it('can still be read in full, by pointing at it', () => {
    render(<PropertyRow label="Aperçu de la répétition">4×</PropertyRow>)

    expect(screen.getByTitle('Aperçu de la répétition')).toHaveTextContent(
      'Aperçu de la répétition',
    )
  })

  // Stacked rows give the label its own line, so nothing is ever cut there.
  it('carries the same title stacked, where the column does not bind', () => {
    render(
      <PropertyRow label="Aperçu de la répétition" shape="stacked">
        4×
      </PropertyRow>,
    )

    expect(screen.getByText('Aperçu de la répétition')).toHaveAttribute('title')
  })
})

/**
 * A path and a hash are ONE value, not a label with a line under it: in a box whose every other
 * row is a pair, stacking them reads as a label whose value went missing — which is exactly how
 * it was reported. `wrap` keeps the pair and gives the value a second line instead.
 */
describe('a value too long for its column but still a value', () => {
  it('stays beside its label rather than dropping under it', () => {
    render(
      <PropertyRow label="Emplacement" shape="wrap">
        Images/facade.jpg
      </PropertyRow>,
    )

    const value = screen.getByText('Images/facade.jpg')
    expect(value.className).toContain('break-all')
    expect(value.className).not.toContain('truncate')
    // Same parent as the label: a stacked row would put them in a column instead.
    expect(value.parentElement).toContainElement(screen.getByText('Emplacement'))
  })
})
