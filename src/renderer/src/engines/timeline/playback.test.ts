import { describe, expect, it, vi } from 'vitest'
import { createPlaybackToken } from './playback'

describe('playback token', () => {
  it('hands the token to the last taker', () => {
    const token = createPlaybackToken()

    token.acquire('monitor', vi.fn())
    token.acquire('preview', vi.fn())

    expect(token.holder()).toBe('preview')
  })

  it('revokes the previous holder, so two decoders never fight over the GPU', () => {
    const token = createPlaybackToken()
    const revoked = vi.fn()

    token.acquire('monitor', revoked)
    token.acquire('preview', vi.fn())

    expect(revoked).toHaveBeenCalledTimes(1)
  })

  it('does not revoke a holder re-acquiring its own token', () => {
    const token = createPlaybackToken()
    const revoked = vi.fn()

    token.acquire('monitor', revoked)
    token.acquire('monitor', revoked)

    expect(revoked).not.toHaveBeenCalled()
  })

  it('leaves nobody holding it after a release', () => {
    const token = createPlaybackToken()

    token.acquire('monitor', vi.fn())
    token.release('monitor')

    expect(token.holder()).toBeNull()
  })

  it('ignores a release from someone who no longer holds it', () => {
    const token = createPlaybackToken()

    token.acquire('monitor', vi.fn())
    token.acquire('preview', vi.fn())
    token.release('monitor')

    expect(token.holder()).toBe('preview')
  })
})
