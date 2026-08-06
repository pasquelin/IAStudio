import { describe, expect, it } from 'vitest'
import { cleLibelleEspace, ESPACE_PAR_DEFAUT, ESPACES, espaceParId } from './espaces'

describe('espaces', () => {
  it('donne à chaque espace une clé de libellé traduisible', () => {
    for (const espace of ESPACES) {
      expect(cleLibelleEspace(espace.id)).toBe(`espaces.${espace.id}`)
    }
  })

  it('retrouve un espace par son identifiant', () => {
    expect(espaceParId('3d').famille).toBe('3d')
  })

  it('refuse un identifiant inconnu plutôt que de rendre un espace vide', () => {
    // @ts-expect-error identifiant volontairement invalide
    expect(() => espaceParId('inexistant')).toThrow()
  })

  it('associe une famille de modèles à chaque espace', () => {
    for (const espace of ESPACES) expect(espace.famille).toBeTruthy()
  })

  it('n’a pas deux espaces de même identifiant', () => {
    const ids = ESPACES.map(espace => espace.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('a un espace par défaut qui existe', () => {
    expect(ESPACES.some(espace => espace.id === ESPACE_PAR_DEFAUT)).toBe(true)
  })
})
