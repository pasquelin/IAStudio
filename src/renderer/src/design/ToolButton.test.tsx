import { mdiPencil } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { simpleTooltip } from './tooltip'
import { ToolButton } from './ToolButton'

describe('ToolButton', () => {
  it('nomme le bouton avec son raccourci même sans infobulle', () => {
    render(<ToolButton icon={mdiPencil} label="Pinceau" shortcut="B" />)
    expect(screen.getByRole('button', { name: 'Pinceau (B)' })).toBeInTheDocument()
  })

  it('garde le même nommage avec une infobulle', () => {
    render(<ToolButton icon={mdiPencil} label="Pinceau" shortcut="B" tooltip={simpleTooltip()} />)
    expect(screen.getByRole('button', { name: 'Pinceau (B)' })).toBeInTheDocument()
  })

  it('expose son état actif aux technologies d’assistance', () => {
    render(<ToolButton label="Sélection" active />)
    expect(screen.getByRole('button', { name: 'Sélection' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('rend ses enfants quand aucune icône n’est fournie', () => {
    render(
      <ToolButton label="Couleur">
        <span data-testid="preview" />
      </ToolButton>,
    )
    expect(screen.getByTestId('preview')).toBeInTheDocument()
  })
})
