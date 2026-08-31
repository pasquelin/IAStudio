import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PropertyLabel } from './PropertyLabel'

describe('the name of one property', () => {
  /**
   * The column truncates, and « Segments radiaux » read as « Segments ra… » in every panel of the
   * studio: the whole word has to be reachable somewhere, and hovering is where.
   */
  it('is reachable in full on hover, however narrow the column', () => {
    render(<PropertyLabel label="Segments radiaux" />)

    expect(screen.getByTitle('Segments radiaux')).toBeInTheDocument()
  })

  /** The box that stretches cannot be the box that truncates: the word wears its own. */
  it('truncates the word rather than the column that holds it', () => {
    render(<PropertyLabel label="Segments radiaux" />)

    expect(screen.getByText('Segments radiaux')).toHaveClass('min-w-0', 'truncate')
  })

  /** `label` where it binds a control, `span` where binding would take the focus off a drag. */
  it('binds what it names only when it is asked to', () => {
    const { container } = render(<PropertyLabel label="Rayon" as="label" htmlFor="radius" />)

    expect(container.querySelector('label')).toHaveAttribute('for', 'radius')
  })

  /** For a name one DRAGS, which is not a name a reader steps onto. */
  it('leaves the reader out of a name that is a handle', () => {
    render(<PropertyLabel label="X" hidden />)

    expect(screen.getByTitle('X')).toHaveAttribute('aria-hidden', 'true')
  })
})
