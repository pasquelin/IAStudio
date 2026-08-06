import { beforeEach, describe, expect, it } from 'vitest'
import { borner, PART_MAX, TAILLE_MIN, useOutils } from './outils'

describe('borner', () => {
  it('ne laisse jamais une zone dépasser la moitié du conteneur', () => {
    expect(borner(900, 1000)).toBe(500)
    expect(borner(1000, 400)).toBe(200)
  })

  it('respecte la taille minimale', () => {
    expect(borner(10, 1000)).toBe(TAILLE_MIN)
  })

  it('laisse passer une taille intermédiaire, arrondie', () => {
    expect(borner(300.4, 1000)).toBe(300)
  })

  it('fait primer le plafond sur le plancher quand la fenêtre est minuscule', () => {
    // Sur 200 px de haut, la moitié vaut 100 : moins que TAILLE_MIN, et c'est elle qui gagne
    // — sinon le panneau déborderait de son conteneur.
    expect(borner(500, 200)).toBe(200 * PART_MAX)
  })
})

describe('store des outils', () => {
  beforeEach(() => {
    useOutils.setState({ tailles: {}, reduites: {}, zoneFocus: null })
  })

  it('borne la taille mémorisée au redimensionnement', () => {
    useOutils.getState().redimensionner('bas', 900, 800)
    expect(useOutils.getState().tailles.bas).toBe(400)
  })

  it('replie une zone réduite quand on rappuie sur son icône', () => {
    const etat = useOutils.getState()
    useOutils.setState({ ouverts: { bas: 'assets' }, reduites: { bas: true } })
    etat.basculer('bas', 'assets')
    expect(useOutils.getState().reduites.bas).toBe(false)
    expect(useOutils.getState().ouverts.bas).toBe('assets')
  })

  it('ferme la zone quand on rappuie sur l’icône d’un outil déplié', () => {
    const etat = useOutils.getState()
    useOutils.setState({ ouverts: { bas: 'assets' }, reduites: {} })
    etat.basculer('bas', 'assets')
    expect(useOutils.getState().ouverts.bas).toBeNull()
  })

  it('retire le focus de la zone qu’on ferme', () => {
    const etat = useOutils.getState()
    useOutils.setState({ ouverts: { gauche: 'explorateur' }, zoneFocus: 'gauche' })
    etat.fermer('gauche')
    expect(useOutils.getState().zoneFocus).toBeNull()
  })
})
