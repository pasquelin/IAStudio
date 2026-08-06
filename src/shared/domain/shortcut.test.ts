import { describe, expect, it } from 'vitest'
import {
  COMMAND_IDS,
  DEFAULT_BINDINGS,
  DEFAULT_MOTION,
  MOTION_IDS,
  signatureOf,
  type KeyChord,
} from './shortcut'

const event = (code: string, modifiers: Partial<KeyChord> = {}): KeyChord => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...modifiers,
})

describe('signatureOf', () => {
  it('uses the physical key position, not the printed letter', () => {
    // The same physical key reads "W" on QWERTY and "Z" on AZERTY; only `code` is stable.
    expect(signatureOf(event('KeyW'))).toBe('KeyW')
  })

  it('orders modifiers so the same combination always signs the same', () => {
    expect(signatureOf(event('KeyZ', { metaKey: true, shiftKey: true }))).toBe(
      signatureOf(event('KeyZ', { shiftKey: true, metaKey: true })),
    )
  })

  it('separates a shifted binding from its bare one', () => {
    expect(signatureOf(event('KeyZ', { metaKey: true }))).not.toBe(
      signatureOf(event('KeyZ', { metaKey: true, shiftKey: true })),
    )
  })
})

describe('defaults', () => {
  it('binds every command', () => {
    for (const id of COMMAND_IDS) expect(DEFAULT_BINDINGS[id]).toBeTruthy()
  })

  it('binds every motion', () => {
    for (const id of MOTION_IDS) expect(DEFAULT_MOTION[id]).toBeTruthy()
  })

  it('puts the gizmos on the Blender letters', () => {
    expect(DEFAULT_BINDINGS['scene.translate']).toBe('KeyG')
    expect(DEFAULT_BINDINGS['scene.rotate']).toBe('KeyR')
    expect(DEFAULT_BINDINGS['scene.scale']).toBe('KeyS')
  })

  it('puts flight on the physical ZQSD block with A and E for altitude', () => {
    expect(DEFAULT_MOTION.forward).toBe('KeyW')
    expect(DEFAULT_MOTION.left).toBe('KeyA')
    expect(DEFAULT_MOTION.down).toBe('KeyQ')
    expect(DEFAULT_MOTION.up).toBe('KeyE')
  })

  it('overlaps motion and commands on exactly one key, which flight modality resolves', () => {
    // KeyS is both "back" and "scale". Flight only answers while the right button is held,
    // so the two never listen at the same time. Documented here so a remap keeps it in mind.
    const motion = new Set(Object.values(DEFAULT_MOTION))
    const shared = Object.values(DEFAULT_BINDINGS).filter(signature => motion.has(signature))
    expect(shared).toEqual(['KeyS'])
  })
})
