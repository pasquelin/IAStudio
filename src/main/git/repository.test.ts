import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { GitStatus } from '@shared/domain/git'
import { detectGit, gitVersionProbe } from './binary'
import { GITIGNORE_FILE, openRepository, type Repository } from './repository'

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

/** Somebody, so `git commit` does not stop on a machine where git was never configured. */
const AUTHOR = { name: 'Suite', email: 'suite@example.com' }

async function repositoryWithACommit(): Promise<Repository> {
  const repository = openRepository(await project())
  await repository.init()
  await repository.stage(['notes.txt', '.project.json'])
  await repository.commit('premiere version', false, AUTHOR)
  return repository
}

describe('what the tick does', () => {
  it('moves a file into what the next version will record', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = openRepository(await project())
    await repository.init()
    await repository.stage(['notes.txt'])

    expect(stageOf(await repository.status(), 'notes.txt')).toBe('staged')
  })

  /**
   * The case a single command gets wrong. `git reset` resolves HEAD, so on a repository that has
   * no first commit — exactly what `git init` leaves, and exactly where somebody first ticks
   * something by mistake — it fails on an ambiguous argument instead of unticking.
   */
  it('takes one back out on a repository that has no first commit yet', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = openRepository(await project())
    await repository.init()
    await repository.stage(['notes.txt'])
    await repository.unstage(['notes.txt'])

    expect(stageOf(await repository.status(), 'notes.txt')).toBe('untracked')
  })

  /** And on one that has: here `git rm --cached` would stage a DELETION rather than untick. */
  it('takes one back out on a repository with a history, without deleting it', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    await writeFile(join(repository.root, 'notes.txt'), 'edited')
    await repository.stage(['notes.txt'])
    await repository.unstage(['notes.txt'])

    const status = await repository.status()
    expect(stageOf(status, 'notes.txt')).toBe('unstaged')
    expect(status.files.find(file => file.path === 'notes.txt')?.change).toBe('modified')
  })
})

describe('recording a version', () => {
  it('leaves a head, a branch and nothing waiting', async ({ skip }) => {
    if (!hasGit) return skip()

    const status = await (await repositoryWithACommit()).status()

    expect(status.head).not.toBeNull()
    expect(status.branch).not.toBeNull()
    expect(status.files.map(file => file.path)).toEqual(['.gitignore'])
  })

  it('puts a modified file back the way the last version has it', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    await writeFile(join(repository.root, 'notes.txt'), 'edited')

    await repository.restore(['notes.txt'])

    expect(await readFile(join(repository.root, 'notes.txt'), 'utf8')).toBe('hello')
  })

  /** A file staged AND edited again would otherwise need the button twice to come back. */
  it('puts one back from both halves at once', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    await writeFile(join(repository.root, 'notes.txt'), 'staged edit')
    await repository.stage(['notes.txt'])
    await writeFile(join(repository.root, 'notes.txt'), 'second edit')

    await repository.restore(['notes.txt'])

    const status = await repository.status()
    expect(status.files.map(file => file.path)).toEqual(['.gitignore'])
  })
})

describe('branches', () => {
  it('names the one that is out among those there are', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    await repository.createBranch('essai-lumiere')

    expect(await repository.branches()).toContainEqual({ name: 'essai-lumiere', current: true })
  })

  it('swings the folder over to another, and back', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    const first = (await repository.status()).branch ?? ''
    await repository.createBranch('essai-lumiere')

    await repository.checkout(first)

    expect((await repository.status()).branch).toBe(first)
  })
})

describe('the history', () => {
  it('answers with the versions recorded, newest first', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    await writeFile(join(repository.root, 'notes.txt'), 'edited')
    await repository.stage(['notes.txt'])
    await repository.commit('deuxieme version', false, AUTHOR)

    expect((await repository.log(10, 0)).map(entry => entry.message)).toEqual([
      'deuxieme version',
      'premiere version',
    ])
  })

  /** The layout depends on it: a child has to be reached before the commits it came from. */
  it('gives the first commit no parent, and the next one the first', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    await writeFile(join(repository.root, 'notes.txt'), 'edited')
    await repository.stage(['notes.txt'])
    await repository.commit('deuxieme version', false, AUTHOR)

    const [second, first] = await repository.log(10, 0)
    expect(first?.parents).toEqual([])
    expect(second?.parents).toEqual([first?.hash])
  })

  it('skips what the caller already holds', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    await writeFile(join(repository.root, 'notes.txt'), 'edited')
    await repository.stage(['notes.txt'])
    await repository.commit('deuxieme version', false, AUTHOR)

    expect((await repository.log(10, 1)).map(entry => entry.message)).toEqual(['premiere version'])
  })

  /** A branch nobody is standing on still belongs on the graph — `--all` is what puts it there. */
  it('carries a branch that is not the one checked out', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    const first = (await repository.status()).branch ?? ''
    await repository.createBranch('essai-lumiere')
    await writeFile(join(repository.root, 'notes.txt'), 'on the branch')
    await repository.stage(['notes.txt'])
    await repository.commit('essai', false, AUTHOR)
    await repository.checkout(first)

    expect((await repository.log(10, 0)).map(entry => entry.message)).toContain('essai')
  })

  it('names the files one version changed', async ({ skip }) => {
    if (!hasGit) return skip()

    const repository = await repositoryWithACommit()
    const [head] = await repository.log(1, 0)

    expect((await repository.commitFiles(head?.hash ?? '')).map(file => file.path).sort()).toEqual([
      '.project.json',
      'notes.txt',
    ])
  })
})

/** Which half of git a path sits in, or nothing where it is not waiting at all. */
function stageOf(status: GitStatus, path: string): string | undefined {
  return status.files.find(file => file.path === path)?.stage
}
