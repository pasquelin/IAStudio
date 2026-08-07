import { describe, expect, it } from 'vitest'
import { bindingOf, COMMAND_REGISTRY } from './command'
import {
  acceleratorOf,
  DEFAULT_MOTION,
  MOTION_IDS,
  shortcutLabel,
  signatureOf,
  type KeyChord,
} from './shortcut'

/** No overrides: what the application ships with. */
const shipped = (id: Parameters<typeof bindingOf>[0]): string => bindingOf(id, {}) ?? ''

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
  it('binds every motion, which is held rather than fired', () => {
    for (const id of MOTION_IDS) expect(DEFAULT_MOTION[id]).toBeTruthy()
  })

  it('puts the gizmos on the Blender letters', () => {
    expect(shipped('scene.translate')).toBe('KeyG')
    expect(shipped('scene.rotate')).toBe('KeyR')
    expect(shipped('scene.scale')).toBe('KeyS')
  })

  it('puts flight on the physical ZQSD block with A and E for altitude', () => {
    expect(DEFAULT_MOTION.forward).toBe('KeyW')
    expect(DEFAULT_MOTION.left).toBe('KeyA')
    expect(DEFAULT_MOTION.down).toBe('KeyQ')
    expect(DEFAULT_MOTION.up).toBe('KeyE')
  })

  it('overlaps motion and scene commands on exactly one key, which flight modality resolves', () => {
    // KeyS is both "back" and "scale". Flight only answers while the right button is held,
    // so the two never listen at the same time. Documented here so a remap keeps it in mind.
    //
    // Only the scene is checked: motion is flight, flight is the scene, and a timeline command
    // on the same key is resolved by its scope long before either of them is consulted.
    const motion = new Set(Object.values(DEFAULT_MOTION))
    const shared = COMMAND_REGISTRY.filter(
      descriptor => descriptor.scope === 'scene' && motion.has(shipped(descriptor.id)),
    )
    expect(shared.map(descriptor => descriptor.id)).toEqual(['scene.scale'])
  })
})

describe('shortcutLabel', () => {
  it('shows the printed letter of a physical key', () => {
    expect(shortcutLabel('KeyG')).toBe('G')
  })

  it('keeps the modifiers in front', () => {
    expect(shortcutLabel('Shift+KeyG')).toBe('⇧G')
  })

  it('leaves a non-letter code readable', () => {
    expect(shortcutLabel('Delete')).toBe('Delete')
  })

  it('renders every default binding without leaking a raw code', () => {
    expect(shortcutLabel(shipped('scene.undo'))).toBe('⌘Z')
    expect(shortcutLabel(shipped('scene.redo'))).toBe('⇧⌘Z')
  })
})

describe('acceleratorOf', () => {
  // The one place a signature and an Electron accelerator meet. The menu wrote these by hand,
  // which is how it kept advertising a key a remapped command no longer answered to.
  it('spells the command key so it works on both platforms', () => {
    expect(acceleratorOf('Meta+KeyN')).toBe('CmdOrCtrl+N')
  })

  it('names the punctuation keys Electron will not take as codes', () => {
    expect(acceleratorOf('Meta+Comma')).toBe('CmdOrCtrl+,')
    expect(acceleratorOf('Meta+Equal')).toBe('CmdOrCtrl+=')
  })

  it('keeps modifier order and passes named keys through', () => {
    expect(acceleratorOf('Ctrl+Meta+KeyF')).toBe('Ctrl+CmdOrCtrl+F')
    expect(acceleratorOf('Home')).toBe('Home')
  })

  // A command may ship with no key at all: listed, searchable, waiting to be given one.
  it('answers nothing for a command that is bound to nothing', () => {
    expect(acceleratorOf(null)).toBeUndefined()
  })
})

describe('shortcutLabel, on the keys the view commands use', () => {
  it('prints the cap rather than the code', () => {
    expect(shortcutLabel('Meta+Equal')).toBe('⌘=')
    expect(shortcutLabel('Meta+Minus')).toBe('⌘−')
    expect(shortcutLabel('Meta+Digit0')).toBe('⌘0')
    expect(shortcutLabel('Shift+Meta+Semicolon')).toBe('⇧⌘;')
  })
})

// A menu item promising a key Electron cannot spell fires from neither side.
describe('acceleratorFor, on punctuation', () => {
  it('names the keys Electron takes as characters', () => {
    expect(acceleratorFor('Meta+Equal')).toBe('CmdOrCtrl+=')
    expect(acceleratorFor('Meta+Minus')).toBe('CmdOrCtrl+-')
    expect(acceleratorFor('Shift+Meta+Semicolon')).toBe('Shift+CmdOrCtrl+;')
  })
})
