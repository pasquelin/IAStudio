import { describe, expect, it } from 'vitest'
import { DEFAULT_WORKSPACE, workspaceById, workspaceLabelKey, WORKSPACES } from './workspaces'

describe('workspaces', () => {
  it('donne à chaque espace une clé de libellé traduisible', () => {
    for (const workspace of WORKSPACES) {
      expect(workspaceLabelKey(workspace.id)).toBe(`workspaces.${workspace.id}`)
    }
  })

  it('retrouve un espace par son identifiant', () => {
    expect(workspaceById('3d').family).toBe('3d')
  })

  it('refuse un identifiant inconnu plutôt que de rendre un espace vide', () => {
    // @ts-expect-error identifiant volontairement invalide
    expect(() => workspaceById('nope')).toThrow()
  })

  it('associe une famille de modèles à chaque espace', () => {
    for (const workspace of WORKSPACES) expect(workspace.family).toBeTruthy()
  })

  it('n’a pas deux espaces de même identifiant', () => {
    const ids = WORKSPACES.map(workspace => workspace.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('a un espace par défaut qui existe', () => {
    expect(WORKSPACES.some(workspace => workspace.id === DEFAULT_WORKSPACE)).toBe(true)
  })
})
