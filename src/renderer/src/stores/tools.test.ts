import { beforeEach, describe, expect, it } from 'vitest'
import { clamp, MAX_SHARE, MIN_SIZE, useTools } from './tools'

describe('clamp', () => {
  it('ne laisse jamais une zone dépasser la moitié du conteneur', () => {
    expect(clamp(900, 1000)).toBe(500)
    expect(clamp(1000, 400)).toBe(200)
  })

  it('respecte la taille minimale', () => {
    expect(clamp(10, 1000)).toBe(MIN_SIZE)
  })

  it('laisse passer une taille intermédiaire, arrondie', () => {
    expect(clamp(300.4, 1000)).toBe(300)
  })

  it('fait primer le plafond sur le plancher quand la fenêtre est minuscule', () => {
    // Sur 200 px de haut, la moitié vaut 100 : moins que MIN_SIZE, et c'est elle qui gagne
    // — sinon le panneau déborderait de son conteneur.
    expect(clamp(500, 200)).toBe(200 * MAX_SHARE)
  })
})

describe('store des outils', () => {
  beforeEach(() => {
    useTools.setState({ sizes: {}, collapsed: {}, focusedZone: null })
  })

  it('borne la taille mémorisée au redimensionnement', () => {
    useTools.getState().resize('bottom', 900, 800)
    expect(useTools.getState().sizes.bottom).toBe(400)
  })

  it('déplie une zone réduite quand on rappuie sur son icône', () => {
    useTools.setState({ open: { bottom: 'assets' }, collapsed: { bottom: true } })
    useTools.getState().toggle('bottom', 'assets')
    expect(useTools.getState().collapsed.bottom).toBe(false)
    expect(useTools.getState().open.bottom).toBe('assets')
  })

  it('ferme la zone quand on rappuie sur l’icône d’un outil déplié', () => {
    useTools.setState({ open: { bottom: 'assets' }, collapsed: {} })
    useTools.getState().toggle('bottom', 'assets')
    expect(useTools.getState().open.bottom).toBeNull()
  })

  it('retire le focus de la zone qu’on ferme', () => {
    useTools.setState({ open: { left: 'explorer' }, focusedZone: 'left' })
    useTools.getState().close('left')
    expect(useTools.getState().focusedZone).toBeNull()
  })
})
