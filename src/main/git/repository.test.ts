import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { detectGit, gitVersionProbe } from './binary'
import { GITIGNORE_FILE, openRepository } from './repository'

/**
 * The one suite here that runs the real binary, and it is where that is worth paying for: what
 * `git init` leaves on disk is the whole of what this module decides, and no fake can say whether
 * git agreed. Everything ABOVE the port — which codes mean what, which failure gets which
 * sentence, which screen each state stands up — is checked without a repository, in `parse.test.ts`
 * and `service.test.ts`.
 *
 * Skipped rather than failed where git is absent, which is a machine the studio itself supports.
 */
let hasGit = false

beforeAll(async () => {
  hasGit = (await detectGit(gitVersionProbe())).found
})

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'scenario-git-'))
  await writeFile(join(root, '.project.json'), '{}')
  await writeFile(join(root, 'notes.txt'), 'hello')
  return root
}

describe('a project folder under version control', () => {
  it('is not a repository until it is initialised', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = openRepository(await project())

    expect(await repository.isRepository()).toBe(false)
    await repository.init()
    expect(await repository.isRepository()).toBe(true)
  })

  /**
   * The catalogue is a SQLite file the studio rewrites on every open. Tracked, it would land a
   * fresh copy in every commit and an unresolvable binary conflict in every pull.
   */
  it('writes an ignore file that excludes the catalogue', async ({ skip }) => {
    if (!hasGit) return skip()

    const root = await project()
    await openRepository(root).init()

    expect(await readFile(join(root, GITIGNORE_FILE), 'utf8')).toContain('.index/')
  })

  /**
   * A project brought under version control for the second time, or cloned from elsewhere, has
   * rules somebody wrote. Overwriting them to add one line is not a trade the studio gets to make.
   */
  it('leaves an ignore file that was already there alone', async ({ skip }) => {
    if (!hasGit) return skip()

    const root = await project()
    await writeFile(join(root, GITIGNORE_FILE), '*.mp4\n')

    await openRepository(root).init()

    expect(await readFile(join(root, GITIGNORE_FILE), 'utf8')).toBe('*.mp4\n')
  })

  it('reports a fresh repository as all untracked, with no head yet', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = openRepository(await project())
    await repository.init()

    const status = await repository.status()

    expect(status.head).toBeNull()
    expect(status.files.map(file => file.path).sort()).toEqual([
      '.gitignore',
      '.project.json',
      'notes.txt',
    ])
    expect(status.files.every(file => file.stage === 'untracked')).toBe(true)
  })

  /**
   * A project sitting UNDER an unrelated repository — a home directory somebody versioned once —
   * must read as its own uninitialised folder. Answering "yes, a repository" there would show
   * that repository's thousands of files and write the project's first commit into it.
   */
  it('refuses a repository it merely sits inside', async ({ skip }) => {
    if (!hasGit) return skip()

    const outer = await project()
    await openRepository(outer).init()

    const inner = join(outer, 'a-project-of-its-own')
    await mkdir(inner)

    expect(await openRepository(inner).isRepository()).toBe(false)
  })
})
