import { describe, expect, it } from 'vitest'
import { cleLibelleEspace, ESPACES, espaceParId } from './espaces'

describe('espaces', () => {
  it('donne à chaque espace une clé de libellé traduisible', () => {
    for (const espace of ESPACES) {
      expect(cleLibelleEspace(espace.id)).toBe(`espaces.${espace.id}`)
    }
  })

  it('retrouve un espace par son identifiant', () => {
    expect(espaceParId('3d').icone).toBeTruthy()
  })

  it('pose la bibliothèque d’assets en bande basse dans tous les espaces', () => {
    for (const espace of ESPACES) {
      const assets = espace.panneaux.find(panneau => panneau.id === 'assets')
      expect(assets?.zone).toBe('bas')
    }
  })

  it('ne place jamais un onglet en premier, faute de panneau de référence', () => {
    for (const espace of ESPACES) {
      expect(espace.panneaux[0]?.zone).not.toBe('onglet')
    }
  })

  it('n’ouvre jamais deux fois le même panneau dans un espace', () => {
    for (const espace of ESPACES) {
      const ids = espace.panneaux.map(panneau => panneau.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
