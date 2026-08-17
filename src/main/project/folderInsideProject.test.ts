import { mkdtemp, mkdir, realpath, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { folderInsideProject } from './folderInsideProject'

let root = ''
let outside = ''

beforeEach(async () => {
  // Through `realpath`: on macOS `tmpdir()` is under `/var`, itself a link to `/private/var`, and
  // comparing an unresolved root against a resolved destination refuses everything.
  const base = await realpath(await mkdtemp(join(tmpdir(), 'confine-')))
  root = join(base, 'project')
  outside = join(base, 'elsewhere')
  await mkdir(root)
  await mkdir(outside)
})

describe('where an export may land inside a project', () => {
  it('answers a folder of the project, whether it exists yet or not', async () => {
    expect(await folderInsideProject(root, 'Exports')).toBe(join(root, 'Exports'))

    await mkdir(join(root, 'Rendus'))
    expect(await folderInsideProject(root, 'Rendus')).toBe(join(root, 'Rendus'))
  })

  /**
   * The one hole a name cannot show: `pathSegment` refuses every shape that climbs out, and a
   * link named `Exports` refuses nothing while pointing anywhere. Both ends are resolved for it.
   */
  it('refuses a symbolic link that walks out of the project', async () => {
    await symlink(outside, join(root, 'Exports'))

    expect(await folderInsideProject(root, 'Exports')).toBeNull()
  })

  // Answered as it was NAMED rather than as it resolves: writing through a link the user made
  // inside their own project is what they asked for, and only where it lands is in question.
  it('takes a link that stays inside', async () => {
    await mkdir(join(root, 'Rendus'))
    await symlink(join(root, 'Rendus'), join(root, 'Raccourci'))

    expect(await folderInsideProject(root, 'Raccourci')).toBe(join(root, 'Raccourci'))
  })

  // The first holds the token a remote was cloned with; the second is the catalogue database.
  it('refuses the two folders that are not anybody’s export', async () => {
    expect(await folderInsideProject(root, '.git')).toBeNull()
    expect(await folderInsideProject(root, '.index')).toBeNull()
  })

  it('refuses a project that is not there at all', async () => {
    expect(await folderInsideProject(join(root, 'gone'), 'Exports')).toBeNull()
  })
})
