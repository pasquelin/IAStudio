import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { workingBlob } from './blob'

/**
 * Real files rather than a fake, because what is under test is what the DISK resolves to: a fake
 * would answer whatever the shape of the path suggested, which is the very thing being refused.
 * On macOS the temporary folder is itself reached through a link, so the ordinary case below is
 * also what proves both ends have to be resolved.
 */
async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'scenario-blob-'))
  await writeFile(join(root, 'notes.txt'), 'hello')
  await mkdir(join(root, '.git'))
  await writeFile(
    join(root, '.git', 'config'),
    '[remote "origin"]\n\turl = https://user:token@host\n',
  )
  return root
}

describe('the bytes of a file as the working copy holds it', () => {
  it('reads a file the project owns', async () => {
    expect(await workingBlob(await project(), 'notes.txt')).toEqual(
      new Uint8Array(Buffer.from('hello')),
    )
  })

  it('refuses a symbolic link that leaves the project', async () => {
    const root = await project()
    const outside = await mkdtemp(join(tmpdir(), 'scenario-outside-'))
    await writeFile(join(outside, 'id_rsa'), 'secret')
    await symlink(join(outside, 'id_rsa'), join(root, 'key'))

    expect(await workingBlob(root, 'key')).toBeNull()
  })

  // The refusal is about leaving, never about links: one pointing inside is an ordinary file.
  it('follows a symbolic link that stays inside', async () => {
    const root = await project()
    await symlink(join(root, 'notes.txt'), join(root, 'alias.txt'))

    expect(await workingBlob(root, 'alias.txt')).toEqual(new Uint8Array(Buffer.from('hello')))
  })

  it('refuses the repository config, which is inside and holds the token of a remote', async () => {
    expect(await workingBlob(await project(), '.git/config')).toBeNull()
  })

  it('answers nothing for a path the project does not hold', async () => {
    expect(await workingBlob(await project(), 'absent.txt')).toBeNull()
  })
})
