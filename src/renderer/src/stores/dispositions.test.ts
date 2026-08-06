import { beforeEach, describe, expect, it } from 'vitest'
import { useDispositions, type DispositionSerialisee } from './dispositions'

function disposition(marqueur: string): DispositionSerialisee {
  return {
    grid: { root: { type: 'branch', data: [] }, width: 0, height: 0, orientation: 'HORIZONTAL' },
    panels: { [marqueur]: { id: marqueur, contentComponent: marqueur } },
  } as DispositionSerialisee
}

describe('store des dispositions', () => {
  beforeEach(() => {
    useDispositions.setState({ espaceActif: 'image', dispositions: {} })
  })

  it('mémorise une disposition par espace', () => {
    const { memoriser } = useDispositions.getState()
    memoriser('image', disposition('generateur'))
    memoriser('3d', disposition('viewport'))

    const { dispositions } = useDispositions.getState()
    expect(dispositions.image?.panels).toHaveProperty('generateur')
    expect(dispositions['3d']?.panels).toHaveProperty('viewport')
  })

  it('restitue la disposition mémorisée après un changement d’espace', () => {
    const { memoriser, activerEspace } = useDispositions.getState()
    memoriser('image', disposition('generateur'))
    activerEspace('3d')
    activerEspace('image')

    const etat = useDispositions.getState()
    expect(etat.espaceActif).toBe('image')
    expect(etat.dispositions.image?.panels).toHaveProperty('generateur')
  })

  it('oublie la disposition d’un seul espace', () => {
    const { memoriser, oublier } = useDispositions.getState()
    memoriser('image', disposition('generateur'))
    memoriser('audio', disposition('pistes'))
    oublier('image')

    const { dispositions } = useDispositions.getState()
    expect(dispositions.image).toBeUndefined()
    expect(dispositions.audio?.panels).toHaveProperty('pistes')
  })
})
