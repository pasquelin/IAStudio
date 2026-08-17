import { beforeEach, describe, expect, it } from 'vitest'
import type { GitRepository } from '@shared/domain/git'
import { installFakeBridge } from '@/services/fakeBridge'
import { useGit } from './git'

const READY: GitRepository = {
  kind: 'ready',
  status: { branch: 'main', head: 'a3f9c1e', upstream: null, ahead: 0, behind: 0, files: [] },
}

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
