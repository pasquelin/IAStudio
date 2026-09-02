import { describe, expect, it } from 'vitest'
import { motionFor } from './bindings'

/**
 * A flight reads the raw code and cancels the event in the CAPTURE phase, so whatever it claims
 * never reaches a command at all. Under a permanent flight that is forever — ⌘Z would be eaten
 * as `forward` on AZERTY, where the key printing `z` sits at the code `KeyW`.
 */
describe('what a flight may claim of a key', () => {
  it('takes a bare direction, and one under shift, which IS boost', () => {
    expect(motionFor('KeyW')).toBe('forward')
    expect(motionFor('KeyW', { shiftKey: true })).toBe('forward')
  })

  it('leaves a key the other three modifiers hold to the command that wants it', () => {
    expect(motionFor('KeyW', { metaKey: true })).toBeNull()
    expect(motionFor('KeyW', { ctrlKey: true })).toBeNull()
    expect(motionFor('KeyW', { altKey: true })).toBeNull()
  })

  it('answers nothing for a key no direction sits on', () => {
    expect(motionFor('KeyB')).toBeNull()
  })
})
