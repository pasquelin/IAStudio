import { mdiCursorDefaultOutline, mdiPencil } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar, type Outil } from './Toolbar'

const OUTILS: Outil[] = [
  { id: 'selection', cleLibelle: 'actions.fermer', icone: mdiCursorDefaultOutline, raccourci: 'V' },
  { id: 'pinceau', cleLibelle: 'actions.generer', icone: mdiPencil, raccourci: 'B' },
]

describe('Toolbar', () => {
  it('rend un bouton par outil et signale celui qui est actif', () => {
    render(<Toolbar outils={OUTILS} outilActif="pinceau" surOutil={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Générer (B)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Fermer (V)' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('remonte l’outil choisi', async () => {
    const surOutil = vi.fn()
    render(<Toolbar outils={OUTILS} surOutil={surOutil} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer (V)' }))
    expect(surOutil).toHaveBeenCalledWith('selection')
  })

  it('masque une section passée à false', () => {
    render(<Toolbar outils={OUTILS} surOutil={vi.fn()} sections={{ outils: false }} />)
    expect(screen.queryByRole('button', { name: 'Générer (B)' })).not.toBeInTheDocument()
  })

  it('remplace une section par le nœud fourni', () => {
    render(
      <Toolbar
        outils={OUTILS}
        surOutil={vi.fn()}
        sections={{ outils: <span data-testid="remplacement" /> }}
      />,
    )
    expect(screen.getByTestId('remplacement')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Générer (B)' })).not.toBeInTheDocument()
  })

  it('n’affiche annuler et rétablir que si les rappels existent', () => {
    const { rerender } = render(<Toolbar outils={OUTILS} surOutil={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()

    rerender(<Toolbar outils={OUTILS} surOutil={vi.fn()} surAnnuler={vi.fn()} peutAnnuler />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeEnabled()
  })

  it('désactive annuler quand la pile est vide', () => {
    render(<Toolbar outils={OUTILS} surOutil={vi.fn()} surAnnuler={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })

  it('déclare son orientation', () => {
    render(<Toolbar outils={OUTILS} surOutil={vi.fn()} orientation="horizontale" />)
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'horizontal')
  })
})
