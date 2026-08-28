import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_ROLE_PATHS, FOLDER_ROLES, ROLE_MARKER } from '@shared/domain/folderRole'
import { exists } from '@main/persistence'
import {
  ensureRoleFolder,
  layRoleFolders,
  markRoleFolder,
  resolveRoleFolders,
  ROLE_CACHE_FILE,
  writeRoleCache,
} from './folderRoles'

let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ia-studio-roles-'))
})

/** The map a project just laid out answers with, cache written as an open would write it. */
async function resolved(): Promise<Record<string, string | undefined>> {
  const { roles, walked } = await resolveRoleFolders(root)
  if (walked) await writeRoleCache(root, roles)
  return roles
}

describe('the tree a new project is laid out with', () => {
  it('gives every role a folder, and every folder a marker saying what it is for', async () => {
    await layRoleFolders(root)

    for (const role of FOLDER_ROLES) {
      const folder = DEFAULT_ROLE_PATHS[role]
      expect(await readFile(join(root, folder, ROLE_MARKER), 'utf8')).toBe(`${role}\n`)
    }
  })

  it('answers where each role sits without walking, once the cache is written', async () => {
    await layRoleFolders(root)
    await resolved()

    expect(await resolveRoleFolders(root)).toEqual({ roles: DEFAULT_ROLE_PATHS, walked: false })
  })
})

/**
 * 🛑 What the marker is FOR, and the only reason it exists rather than a table of paths: the
 * Finder renames without telling the studio, and a map keyed by path is wrong from that moment.
 */
describe('a folder the user moved behind the studio', () => {
  it('goes on serving its role after being renamed', async () => {
    await layRoleFolders(root)
    await resolved()

    await rename(join(root, 'Modelling/Models'), join(root, 'Modelling/Mes modèles'))

    expect((await resolved()).models).toBe('Modelling/Mes modèles')
  })

  it('goes on serving after being moved under another folder entirely', async () => {
    await layRoleFolders(root)
    await resolved()

    await mkdir(join(root, 'Acte 1'), { recursive: true })
    await rename(join(root, 'Images'), join(root, 'Acte 1/Photos'))

    expect((await resolved()).image).toBe('Acte 1/Photos')
  })

  /** One walk, and the cache is rewritten — the next open pays reads again, not a traversal. */
  it('is found by one walk, and the answer is remembered', async () => {
    await layRoleFolders(root)
    await resolved()
    await rename(join(root, 'Audio'), join(root, 'Sons'))

    expect((await resolveRoleFolders(root)).walked).toBe(true)
    await resolved()

    expect(await resolveRoleFolders(root)).toMatchObject({ walked: false })
  })
})

describe('a role whose folder is gone', () => {
  it('is left out of the map rather than pointed at a folder nothing holds', async () => {
    await layRoleFolders(root)
    await rm(join(root, 'Skyboxes'), { recursive: true })

    const roles = await resolved()
    expect(roles.skyboxes).toBeUndefined()
    expect(roles.image).toBe('Images')
  })

  /** A folder comes back because something is being WRITTEN, never because a project opened. */
  it('gets its folder and its marker back when a write asks for one', async () => {
    await layRoleFolders(root)
    await rm(join(root, 'Skyboxes'), { recursive: true })

    expect(await ensureRoleFolder(root, await resolved(), 'skyboxes')).toBe('Skyboxes')
    expect(await readFile(join(root, 'Skyboxes', ROLE_MARKER), 'utf8')).toBe('skyboxes\n')
  })

  it('keeps the folder it was resolved to rather than laying the default down beside it', async () => {
    await layRoleFolders(root)
    await rename(join(root, 'Images'), join(root, 'Photos'))

    expect(await ensureRoleFolder(root, await resolved(), 'image')).toBe('Photos')
    expect(await exists(join(root, 'Images'))).toBe(false)
  })
})

/** A folder copied brings its marker along — an ordinary accident, not a corrupt project. */
describe('two folders claiming one role', () => {
  it('keeps the shallower of the two, whichever the walk reached first', async () => {
    await markRoleFolder(root, 'Archive/Sauvegarde/Images', 'image')
    await markRoleFolder(root, 'Images', 'image')

    expect((await resolved()).image).toBe('Images')
  })
})

describe('what the studio refuses to believe', () => {
  it('ignores a cache naming a folder that no longer carries the role', async () => {
    await layRoleFolders(root)
    await mkdir(join(root, 'Ailleurs'), { recursive: true })
    await writeRoleCache(root, { image: 'Ailleurs' })

    expect((await resolved()).image).toBe('Images')
  })

  it('ignores a marker holding a word no role answers to', async () => {
    await layRoleFolders(root)
    await mkdir(join(root, 'Bizarre'), { recursive: true })
    await writeFile(join(root, 'Bizarre', ROLE_MARKER), 'sculpture\n')

    expect(Object.values(await resolved())).not.toContain('Bizarre')
  })

  /** A cache that will not parse costs a walk, never the project. */
  it('walks rather than fails when the cache is not JSON', async () => {
    await layRoleFolders(root)
    await mkdir(join(root, '.index'), { recursive: true })
    await writeFile(join(root, ROLE_CACHE_FILE), '{ truncated', 'utf8')

    expect((await resolved()).image).toBe('Images')
  })
})
