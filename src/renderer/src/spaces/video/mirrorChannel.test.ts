import { describe, expect, it } from 'vitest'
import { mirrorMessageOf } from './mirrorChannel'

/**
 * A `BroadcastChannel` is reachable by anything running on this origin, so what arrives on it is
 * checked rather than trusted: the return hands what it reads straight to an engine that expects
 * a sequence, and a malformed one would take the second screen down with it.
 */
describe('what the video return accepts off the wire', () => {
  const sequence = { tracks: [], settings: { width: 1920, height: 1080 }, playhead: 0 }

  it('takes the five messages the studio publishes', () => {
    expect(mirrorMessageOf({ kind: 'edit', sequence })).toEqual({ kind: 'edit', sequence })
    expect(mirrorMessageOf({ kind: 'time', playhead: 42 })).toEqual({ kind: 'time', playhead: 42 })
    expect(mirrorMessageOf({ kind: 'playing', playing: true, playhead: 8 })).toEqual({
      kind: 'playing',
      playing: true,
      playhead: 8,
    })
    expect(mirrorMessageOf({ kind: 'gone' })).toEqual({ kind: 'gone' })
    // The fifth, which the title claimed away: the return asking the studio to say where it is.
    expect(mirrorMessageOf({ kind: 'ask' })).toEqual({ kind: 'ask' })
  })

  it('refuses anything else, whatever it calls itself', () => {
    expect(mirrorMessageOf(null)).toBeNull()
    expect(mirrorMessageOf('edit')).toBeNull()
    expect(mirrorMessageOf({ kind: 'edit' })).toBeNull()
    // The shape is read at the depth the engine reads it at, so a sequence-shaped hole is caught.
    expect(mirrorMessageOf({ kind: 'edit', sequence: { tracks: [] } })).toBeNull()
    expect(mirrorMessageOf({ kind: 'edit', sequence: { ...sequence, tracks: 'none' } })).toBeNull()
    expect(mirrorMessageOf({ kind: 'time', playhead: 'now' })).toBeNull()
    expect(mirrorMessageOf({ kind: 'playing', playing: 'yes', playhead: 0 })).toBeNull()
  })
})
