import { describe, expect, it } from 'vitest'
import { detectGit } from './binary'

describe('whether this machine has git', () => {
  it('says yes when git answered', async () => {
    expect(await detectGit(async () => ({ installed: true }))).toBe(true)
  })

  it('says no when git answered that it is not installed', async () => {
    expect(await detectGit(async () => ({ installed: false }))).toBe(false)
  })

  /**
   * A plain Windows install has no git at all, and the spawn throws rather than answering. The
   * panel needs the same "no git" screen for both, or it would crash on the commonest case.
   */
  it('says no when the binary would not start at all', async () => {
    const probe = async (): Promise<{ installed: boolean }> => {
      throw new Error('spawn git ENOENT')
    }

    expect(await detectGit(probe)).toBe(false)
  })
})
