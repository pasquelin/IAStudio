import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PontStudio } from '@shared/ipc'
import { BoutonsFenetre } from './BoutonsFenetre'

type PontFenetre = PontStudio['fenetre']

function poserPont(etat: { active: boolean; pleinEcran: boolean; maximisee: boolean }) {
  const fenetre: PontFenetre = {
    fermer: vi.fn(async () => undefined),
    reduire: vi.fn(async () => undefined),
    zoomer: vi.fn(async () => undefined),
    basculerPleinEcran: vi.fn(async () => undefined),
    etat: vi.fn(async () => etat),
    surEtat: vi.fn(() => () => undefined),
  }
  globalThis.studio = { fenetre } as unknown as PontStudio
  return fenetre
}

afterEach(() => {
  globalThis.studio = undefined as unknown as PontStudio
})

describe('BoutonsFenetre', () => {
  it('rend les trois pastilles avec un nom accessible', () => {
    poserPont({ active: true, pleinEcran: false, maximisee: false })
    render(<BoutonsFenetre />)
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réduire' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeInTheDocument()
  })

  it('ferme la fenêtre au clic sur la pastille rouge', async () => {
    const pont = poserPont({ active: true, pleinEcran: false, maximisee: false })
    render(<BoutonsFenetre />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(pont.fermer).toHaveBeenCalledOnce()
  })

  it('bascule le plein écran au clic sur la pastille verte', async () => {
    const pont = poserPont({ active: true, pleinEcran: false, maximisee: false })
    render(<BoutonsFenetre />)
    await userEvent.click(screen.getByRole('button', { name: 'Plein écran' }))
    expect(pont.basculerPleinEcran).toHaveBeenCalledOnce()
  })

  it('désactive « réduire » en plein écran, comme le fait macOS', async () => {
    poserPont({ active: true, pleinEcran: true, maximisee: false })
    render(<BoutonsFenetre />)
    // L'état arrive de façon asynchrone : on attend qu'il soit appliqué.
    expect(await screen.findByRole('button', { name: 'Réduire' })).toBeDisabled()
  })

  it('ne plante pas hors d’Electron, où le pont n’existe pas', () => {
    globalThis.studio = undefined as unknown as PontStudio
    expect(() => render(<BoutonsFenetre />)).not.toThrow()
  })
})
