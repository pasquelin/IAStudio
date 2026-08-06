import { mdiPencil } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { infobulleSimple } from './infobulle'
import { ToolButton } from './ToolButton'

describe('ToolButton', () => {
  it('nomme le bouton avec son raccourci même sans infobulle', () => {
    render(<ToolButton icone={mdiPencil} libelle="Pinceau" raccourci="B" />)
    expect(screen.getByRole('button', { name: 'Pinceau (B)' })).toBeInTheDocument()
  })

  it('garde le même nommage avec une infobulle', () => {
    render(
      <ToolButton
        icone={mdiPencil}
        libelle="Pinceau"
        raccourci="B"
        infobulle={infobulleSimple()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Pinceau (B)' })).toBeInTheDocument()
  })

  it('expose son état actif aux technologies d’assistance', () => {
    render(<ToolButton libelle="Sélection" actif />)
    expect(screen.getByRole('button', { name: 'Sélection' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('rend ses enfants quand aucune icône n’est fournie', () => {
    render(
      <ToolButton libelle="Couleur">
        <span data-testid="apercu" />
      </ToolButton>,
    )
    expect(screen.getByTestId('apercu')).toBeInTheDocument()
  })
})
