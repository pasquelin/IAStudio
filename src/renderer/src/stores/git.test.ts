import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitRemote, GitRepository } from '@shared/domain/git'
import { installFakeBridge } from '@/services/fakeBridge'
import { useGit } from './git'
import { gitReadyRepository } from './git-fixtures'

const READY = gitReadyRepository()
const ORIGIN: GitRemote = { name: 'origin', url: 'https://example.test/one.git' }

beforeEach(() => useGit.setState({ repository: { kind: 'no-project' }, busy: false }))

describe('the repository this window is looking at', () => {
  it('holds what the main process answered', async () => {
    installFakeBridge({ git: { read: () => Promise.resolve(READY) } })

    await useGit.getState().refresh()

    expect(useGit.getState().repository).toEqual(READY)
  })

  /**
   * The main process answers a union for every git failure, so a rejection here means the channel
   * itself failed. What was on screen is the last thing known to be true about the folder — better
   * than a state invented out of an error that says nothing about git.
   */
  it('keeps the last known state when the channel itself fails', async () => {
    installFakeBridge({ git: { read: () => Promise.resolve(READY) } })
    await useGit.getState().refresh()

    installFakeBridge({ git: { read: () => Promise.reject(new Error('no window')) } })
    await useGit.getState().refresh()

    expect(useGit.getState().repository).toEqual(READY)
  })
})

describe('whether a command is in flight', () => {
  /**
   * A commit made in the Git panel while the folder watch is refreshing is the ordinary overlap.
   * A plain boolean would have the first to land clear the flag while the second is still out,
   * and the buttons would come back under a command that has not finished.
   */
  it('stays raised until the LAST of two overlapping commands lands', async () => {
    let settleRead: (answer: GitRepository) => void = () => {}
    let settleStage: (answer: GitRepository) => void = () => {}
    installFakeBridge({
      git: {
        read: () =>
          new Promise<GitRepository>(done => {
            settleRead = done
          }),
        stage: () =>
          new Promise<GitRepository>(done => {
            settleStage = done
          }),
      },
    })

    const one = useGit.getState().refresh()
    const other = useGit.getState().stage(['shot.png'])

    expect(useGit.getState().busy).toBe(true)

    settleRead(READY)
    await one
    expect(useGit.getState().busy).toBe(true)

    settleStage(READY)
    await other
    expect(useGit.getState().busy).toBe(false)
  })
})

describe('what one signal costs in git processes', () => {
  /**
   * Both panels mount `useGitStatus` and dockview keeps the one behind mounted, so every event
   * wakes two askers. Unshared, each of them starts its own `git status` over the same folder —
   * and the folder they are reading is one the studio writes to several times a minute.
   *
   * The read after the wave still runs: what is shared is the answer that is OUT, not the last
   * one given.
   */
  it('runs one status for the panels that ask together, and a fresh one after', async () => {
    let reads = 0
    installFakeBridge({
      git: {
        read: () => {
          reads += 1
          return Promise.resolve(READY)
        },
      },
    })

    await Promise.all([useGit.getState().refresh(), useGit.getState().refresh()])
    expect(reads).toBe(1)

    await useGit.getState().refresh()
    expect(reads).toBe(2)
  })

  /** The server is read on the same signal, by the same askers — three of them since 20 August. */
  it('runs one remote read for the askers that ask together', async () => {
    let reads = 0
    installFakeBridge({
      git: {
        remotes: () => {
          reads += 1
          return Promise.resolve([ORIGIN])
        },
      },
    })

    await Promise.all([useGit.getState().readRemotes(), useGit.getState().readRemotes()])

    expect(reads).toBe(1)
  })

  /**
   * The one asker that must never take the shared answer: it was given before the remote existed,
   * and the bar would show « no server » under a server the user has just named.
   */
  it('does not hand a remote just added the read that was already out', async () => {
    const settle: ((answer: GitRemote[]) => void)[] = []
    installFakeBridge({
      git: {
        addRemote: () => Promise.resolve(READY),
        remotes: () =>
          new Promise<GitRemote[]>(done => {
            settle.push(done)
          }),
      },
    })

    const early = useGit.getState().readRemotes()
    const added = useGit.getState().addRemote('origin', ORIGIN.url)
    await vi.waitFor(() => expect(settle).toHaveLength(2))

    // The read that was out answers what git knew BEFORE the remote was named.
    settle[0]?.([])
    settle[1]?.([ORIGIN])
    await Promise.all([early, added])

    expect(useGit.getState().remote).toEqual(ORIGIN)
  })

  /** The same the other way round: the slow one lands LAST, and must still not have the say. */
  it('drops a remote read that lands after the one that replaced it', async () => {
    const settle: ((answer: GitRemote[]) => void)[] = []
    installFakeBridge({
      git: {
        addRemote: () => Promise.resolve(READY),
        remotes: () =>
          new Promise<GitRemote[]>(done => {
            settle.push(done)
          }),
      },
    })

    const early = useGit.getState().readRemotes()
    const added = useGit.getState().addRemote('origin', ORIGIN.url)
    await vi.waitFor(() => expect(settle).toHaveLength(2))

    settle[1]?.([ORIGIN])
    await added
    settle[0]?.([])
    await early

    expect(useGit.getState().remote).toEqual(ORIGIN)
  })

  /**
   * The IPC clone rebuilds the answer, so every refresh hands back an object nothing has in
   * common with the last one but its contents. Published as is, it re-renders both trees on a
   * folder where nothing moved.
   */
  it('leaves the repository alone when the answer says the same thing', async () => {
    installFakeBridge({ git: { read: () => Promise.resolve(structuredClone(READY)) } })

    await useGit.getState().refresh()
    const held = useGit.getState().repository
    await useGit.getState().refresh()

    expect(useGit.getState().repository).toBe(held)
  })
})
