import { describe, expect, it } from 'vitest'
import { ASSET_TYPES } from './asset'
import { DOCUMENT_KINDS, roleForKind } from './document'
import { roleForAsset } from './asset'
import {
  DEFAULT_ROLE_PATHS,
  FOLDER_ROLES,
  folderForRole,
  isFolderRole,
  preferredRoleFolder,
  roleOfFolder,
} from './folderRole'

describe('the role vocabulary', () => {
  /**
   * A dot would spell an extra level in `folderRoles.${role}`, and the label would come back
   * undefined — the raw key on screen, this repository's costliest defect.
   */
  it('holds no identifier a translation key could not carry', () => {
    expect(FOLDER_ROLES.filter(role => role.includes('.'))).toEqual([])
  })

  it('gives every role a folder of its own', () => {
    expect(new Set(Object.values(DEFAULT_ROLE_PATHS)).size).toBe(FOLDER_ROLES.length)
  })

  it('refuses a value no folder could wear', () => {
    expect(isFolderRole('models')).toBe(true)
    expect(isFolderRole('3D')).toBe(false)
  })
})

describe('what the two vocabularies file under', () => {
  it('names a known role for every document kind', () => {
    for (const kind of DOCUMENT_KINDS) expect(FOLDER_ROLES).toContain(roleForKind(kind))
  })

  it('names a known role for every asset type', () => {
    for (const type of ASSET_TYPES) expect(FOLDER_ROLES).toContain(roleForAsset({ type }))
  })

  /** The whole point of the rework: a document no longer lands in a folder shared with six kinds. */
  it('files a scene and a sky apart', () => {
    expect(roleForKind('scene')).not.toBe(roleForKind('skybox'))
  })
})

describe('the folder a role names', () => {
  it('takes the resolved one over where the role starts', () => {
    expect(folderForRole('models', { models: 'Mes modèles' })).toBe('Mes modèles')
  })

  it('starts where the role starts when nothing resolved it', () => {
    expect(folderForRole('models', { image: 'Photos' })).toBe('Modelling/Models')
    expect(folderForRole('models')).toBe('Modelling/Models')
  })
})

describe('reading a role off a folder', () => {
  it('answers for the folder the role was resolved to, renamed or not', () => {
    expect(roleOfFolder('Mes modèles', { models: 'Mes modèles' })).toBe('models')
  })

  /** A fresh folder wearing the old default name is an ordinary folder, not the role's. */
  it('answers nothing for a folder no role was resolved to', () => {
    expect(roleOfFolder('Modelling/Models', { models: 'Mes modèles' })).toBe(null)
  })
})

describe('two folders claiming one role', () => {
  it('keeps the shallower, which a copy filed underneath cannot be', () => {
    expect(preferredRoleFolder('Modelling/Models', 'Archive/Old/Modelling/Models')).toBe(
      'Modelling/Models',
    )
    expect(preferredRoleFolder('Archive/Old/Modelling/Models', 'Modelling/Models')).toBe(
      'Modelling/Models',
    )
  })

  /**
   * By code unit rather than by the locale the machine was installed in: a project has to resolve
   * the same way on every machine, and a collator is the one thing that would not.
   */
  it('settles a tie the same way whatever the machine', () => {
    expect(preferredRoleFolder('Zèbre', 'Amis')).toBe('Amis')
    expect(preferredRoleFolder('Amis', 'Zèbre')).toBe('Amis')
  })
})
