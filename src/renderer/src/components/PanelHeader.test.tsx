import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PanelHeader } from './PanelHeader'

describe('PanelHeader', () => {
  it('shows the title and both slots', () => {
    render(
      <PanelHeader title="Assets" trailing={<button type="button">Fermer</button>}>
        <button type="button">Importer</button>
      </PanelHeader>,
    )

    expect(screen.getByText('Assets')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
  })

  // A row too crowded for its width used to push the close button out of the panel, leaving no
  // way to shut it. jsdom measures nothing, so the guarantee is asserted where it is made: the
  // trailing slot sits outside the container that clips.
  it('keeps the trailing slot out of the container that clips', () => {
    const { container } = render(
      <PanelHeader title="Assets" trailing={<button type="button">Fermer</button>}>
        <button type="button">Importer</button>
      </PanelHeader>,
    )

    const clipped = container.querySelector('.overflow-hidden')
    expect(clipped).toContainElement(screen.getByRole('button', { name: 'Importer' }))
    expect(clipped).not.toContainElement(screen.getByRole('button', { name: 'Fermer' }))
  })
})
