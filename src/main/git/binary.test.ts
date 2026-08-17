import { describe, expect, it } from 'vitest'
import { detectGit } from './binary'

describe('whether this machine has git', () => {
  it('names the version that answered', async () => {
    const probe = async () => ({ installed: true, major: 2, minor: 45, patch: 1 })

    expect(await detectGit(probe)).toEqual({ found: true, version: '2.45.1' })
  })

  it('says no when git answered that it is not installed', async () => {
    const probe = async () => ({ installed: false, major: 0, minor: 0, patch: 0 })

    expect(await detectGit(probe)).toEqual({ found: false })
  })

  /**
   * A plain Windows install has no git at all, and the spawn throws rather than answering. The
   * panel needs the same "no git" screen for both, or it would crash on the commonest case.
   */
  it('says no when the binary would not start at all', async () => {
    const probe = async () => {
      throw new Error('spawn git ENOENT')
    }

    expect(await detectGit(probe)).toEqual({ found: false })
  })
})
