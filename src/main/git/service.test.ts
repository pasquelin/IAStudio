import { describe, expect, it, vi } from 'vitest'
import type { GitStatus } from '@shared/domain/git'
import { createGitService, type GitServiceDeps } from './service'
import type { Repository } from './repository'

const CLEAN: GitStatus = {
  branch: 'main',
  head: 'a3f9c1e',
  upstream: null,
  ahead: 0,
  behind: 0,
  files: [],
}

function repository(overrides: Partial<Repository> = {}): Repository {
  return {
    root: '/projects/Mon projet',
    isRepository: () => Promise.resolve(true),
    init: () => Promise.resolve(),
    status: () => Promise.resolve(CLEAN),
    stage: () => Promise.resolve(),
    unstage: () => Promise.resolve(),
    restore: () => Promise.resolve(),
    commit: () => Promise.resolve(),
    branches: () => Promise.resolve([{ name: 'main', current: true }]),
    createBranch: () => Promise.resolve(),
    checkout: () => Promise.resolve(),
    log: () => Promise.resolve([]),
    commitFiles: () => Promise.resolve([]),
    diff: () => Promise.resolve({ kind: 'empty' }),
    bytes: () => Promise.resolve(null),
    ...overrides,
  }
}

function service(overrides: Partial<GitServiceDeps> = {}) {
  return createGitService({
    projectPath: () => '/projects/Mon projet',
    binaryPath: () => undefined,
    identity: () => undefined,
    probe: () => async () => ({ installed: true, major: 2, minor: 45, patch: 1 }),
    open: () => repository(),
    ...overrides,
  })
}

describe('what the panel is looking at', () => {
  it('has no project to version before one is open', async () => {
    expect(await service({ projectPath: () => null }).read()).toEqual({ kind: 'no-project' })
  })

  it('has no git when the machine has none', async () => {
    const missing = service({
      probe: () => async () => ({ installed: false, major: 0, minor: 0, patch: 0 }),
    })

    expect(await missing.read()).toEqual({ kind: 'no-binary' })
  })

  /**
   * simple-git refuses a binary path holding a space — which is where the default Windows install
   * puts it — by throwing as the instance is built. The user gets the screen they would get with
   * no git at all, rather than an unhandled rejection.
   */
  it('has no git when the binary the user named cannot be used', async () => {
    const refused = service({
      open: () => {
        throw new Error('Invalid value supplied for custom binary')
      },
    })

    expect(await refused.read()).toEqual({ kind: 'no-binary' })
  })

  it('is uninitialised for a project folder git knows nothing about', async () => {
    const plain = service({
      open: () => repository({ isRepository: () => Promise.resolve(false) }),
    })

    expect(await plain.read()).toEqual({ kind: 'uninitialised' })
  })

  it('is ready, carrying the status, once the folder is a repository', async () => {
    expect(await service().read()).toEqual({ kind: 'ready', status: CLEAN })
  })

  it('carries both a reason and git own line when a command fails', async () => {
    const broken = service({
      open: () =>
        repository({
          status: () =>
            Promise.reject(new Error('fatal: Unable to create index.lock: File exists')),
        }),
    })

    expect(await broken.read()).toEqual({
      kind: 'failed',
      reason: 'locked',
      detail: 'fatal: Unable to create index.lock: File exists',
    })
  })
})

describe('what the service holds rather than asks again', () => {
  /**
   * The detection spawns a process. Asking per refresh would put a spawn on the path of every
   * status the panel draws, for an answer that cannot change while the studio runs.
   */
  it('asks the machine for git once, however often the panel refreshes', async () => {
    const probe = vi.fn(async () => ({ installed: true, major: 2, minor: 45, patch: 1 }))
    const held = service({ probe: () => probe })

    await held.read()
    await held.read()

    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('asks again once told to forget, which is how a changed preference lands', async () => {
    const probe = vi.fn(async () => ({ installed: true, major: 2, minor: 45, patch: 1 }))
    const held = service({ probe: () => probe })

    await held.read()
    held.forget()
    await held.read()

    expect(probe).toHaveBeenCalledTimes(2)
  })

  /**
   * The instance carries simple-git's own command queue, which is what stops two refreshes
   * colliding on `index.lock`. Building a fresh one per call hands out a fresh queue with it,
   * which is the same as having none.
   */
  it('opens one port per project, not one per call', async () => {
    const open = vi.fn(() => repository())
    const held = service({ open })

    await held.read()
    await held.read()

    expect(open).toHaveBeenCalledTimes(1)
  })

  it('opens a fresh port when the project changes', async () => {
    const open = vi.fn(() => repository())
    let folder = '/projects/one'
    const held = service({ open, projectPath: () => folder })

    await held.read()
    folder = '/projects/two'
    await held.read()

    expect(open).toHaveBeenCalledTimes(2)
  })
})

describe('bringing a project under version control', () => {
  it('answers with the state git init left, not with what came before it', async () => {
    let initialised = false
    const fresh = service({
      open: () =>
        repository({
          isRepository: () => Promise.resolve(initialised),
          init: async () => {
            initialised = true
          },
        }),
    })

    expect(await fresh.read()).toEqual({ kind: 'uninitialised' })
    expect(await fresh.init()).toEqual({ kind: 'ready', status: CLEAN })
  })

  it('says why when git refuses to initialise', async () => {
    const refused = service({
      open: () =>
        repository({
          isRepository: () => Promise.resolve(false),
          init: () => Promise.reject(new Error('fatal: cannot mkdir .git: Permission denied')),
        }),
    })

    expect(await refused.init()).toMatchObject({ kind: 'failed', reason: 'unknown' })
  })
})
