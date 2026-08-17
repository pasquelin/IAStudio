import { beforeEach, describe, expect, it } from 'vitest'
import type { GitRepository } from '@shared/domain/git'
import { installFakeBridge } from '@/services/fakeBridge'
import { useGit } from './git'

const READY: GitRepository = {
  kind: 'ready',
  status: { branch: 'main', head: 'a3f9c1e', upstream: null, ahead: 0, behind: 0, files: [] },
}

beforeEach(() => useGit.setState({ repository: { kind: 'no-project' }, busy: false }))

/** A read the test settles by hand, so both panels can be caught mid-refresh. */
function heldRead(): { settle: (answer: GitRepository) => void } {
  let resolve: (answer: GitRepository) => void = () => {}

  installFakeBridge({
    git: {
      read: () =>
        new Promise<GitRepository>(done => {
          resolve = done
        }),
    },
  })

  return { settle: answer => resolve(answer) }
}

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
   * Both version panels mount the same hook, so two refreshes overlap on every project change.
   * A plain boolean would have the first to land clear the flag while the second is still out,
   * and the buttons would come back under a command that has not finished.
   */
  it('stays raised until the LAST of two overlapping refreshes lands', async () => {
    const first = heldRead()
    const one = useGit.getState().refresh()
    const second = heldRead()
    const other = useGit.getState().refresh()

    expect(useGit.getState().busy).toBe(true)

    first.settle(READY)
    await one
    expect(useGit.getState().busy).toBe(true)

    second.settle(READY)
    await other
    expect(useGit.getState().busy).toBe(false)
  })
})
