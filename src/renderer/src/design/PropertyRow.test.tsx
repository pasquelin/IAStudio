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
  it('can still be read in full, by pointing at it', () => {
    render(<PropertyRow label="Aperçu de la répétition">4×</PropertyRow>)

    expect(screen.getByText('Aperçu de la répétition')).toHaveAttribute(
      'title',
      'Aperçu de la répétition',
    )
  })

  // Stacked rows give the label its own line, so nothing is ever cut there.
  it('carries the same title stacked, where the column does not bind', () => {
    render(
      <PropertyRow label="Aperçu de la répétition" stacked>
        4×
      </PropertyRow>,
    )

    expect(screen.getByText('Aperçu de la répétition')).toHaveAttribute('title')
  })
})
