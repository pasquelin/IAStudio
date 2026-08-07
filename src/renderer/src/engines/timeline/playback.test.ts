import { describe, expect, it, vi } from 'vitest'
import { createPlaybackToken, createTransportRegistry, programOwner } from './playback'

function fakeTransport(playing = false) {
  let running = playing
  return {
    play: vi.fn(() => {
      running = true
    }),
    pause: vi.fn(() => {
      running = false
    }),
    playing: () => running,
  }
}

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

describe('transport registry', () => {
  it('starts a stopped player and stops a running one', () => {
    const registry = createTransportRegistry()
    const transport = fakeTransport()
    registry.register('program', transport)

    registry.toggle('program')
    expect(transport.play).toHaveBeenCalledTimes(1)

    registry.toggle('program')
    expect(transport.pause).toHaveBeenCalledTimes(1)
  })

  it('ignores a player that is not there, rather than throwing on a key press', () => {
    expect(() => createTransportRegistry().toggle('nobody')).not.toThrow()
  })

  it('forgets a player once it unregisters', () => {
    const registry = createTransportRegistry()
    const transport = fakeTransport()

    registry.register('program', transport)()
    registry.toggle('program')

    expect(transport.play).not.toHaveBeenCalled()
    expect(registry.get('program')).toBeNull()
  })

  it('keeps the live player when a remount registers before the old one cleans up', () => {
    const registry = createTransportRegistry()
    const previous = fakeTransport()
    const next = fakeTransport()

    const unregisterPrevious = registry.register('program', previous)
    registry.register('program', next)
    unregisterPrevious()

    expect(registry.get('program')).toBe(next)
  })

  it('names the programme monitor of a sequence, never its source', () => {
    expect(programOwner('doc-1')).toBe('doc-1:program')
  })
})
