import { describe, expect, it } from 'vitest'
import { bindingOf, COMMAND_REGISTRY } from './command'
import {
  acceleratorOf,
  DEFAULT_MOTION,
  isSignature,
  MOTION_IDS,
  runsWhileTyping,
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

/** Marks what the caller was asked to name, so a key left unnamed stands out in the output. */
const named = (code: string): string => `<${code}>`

describe('shortcutLabel', () => {
  it('shows the printed letter of a physical key', () => {
    expect(shortcutLabel('KeyG', named)).toBe('G')
  })

  it('keeps the modifiers in front', () => {
    expect(shortcutLabel('Shift+KeyG', named)).toBe('⇧G')
  })

  // The bug this replaced: `Delete` and `Space` are words, and read as English ones in French.
  it('has the caller name the keys that are words', () => {
    expect(shortcutLabel('Delete', named)).toBe('<Delete>')
    expect(shortcutLabel('Meta+Space', named)).toBe('⌘<Space>')
  })

  it('renders every default binding without leaking a raw code', () => {
    expect(shortcutLabel(shipped('scene.undo'), named)).toBe('⌘Z')
    expect(shortcutLabel(shipped('scene.redo'), named)).toBe('⇧⌘Z')
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

describe('shortcutLabel, on the keys that are neither letters nor named', () => {
  it('prints what the key cap prints', () => {
    expect(shortcutLabel('Meta+Equal', named)).toBe('⌘=')
    expect(shortcutLabel('Meta+Minus', named)).toBe('⌘−')
    expect(shortcutLabel('Shift+Meta+Semicolon', named)).toBe('⇧⌘;')
    expect(shortcutLabel('Meta+Comma', named)).toBe('⌘,')
  })

  it('draws an arrow rather than spelling one', () => {
    expect(shortcutLabel('ArrowUp', named)).toBe('↑')
  })

  it('drops the `Digit` prefix a number key carries', () => {
    expect(shortcutLabel('Meta+Digit0', named)).toBe('⌘0')
  })

  /**
   * Every binding the registry ships is either a glyph or a name the caller supplied. The list
   * used to stop at `Key|Digit|Equal|Minus|Semi`, which is how six word-keys shipped in English.
   */
  it('never leaves a raw code in a shipped binding', () => {
    for (const descriptor of COMMAND_REGISTRY) {
      if (!descriptor.defaultBinding) continue

      // What is left once the caller's names are removed: a glyph or a single printed letter.
      const raw = shortcutLabel(descriptor.defaultBinding, named).replace(/<[^>]+>/g, '')
      expect(raw, descriptor.id).not.toMatch(/[A-Za-z]{2}/)
    }
  })
})

/**
 * The guard that was missing when sixteen commands shipped bound to `'P'` instead of `'KeyP'`.
 * Typecheck green, lint green, every unit test green — `Signature` is a string, and nothing
 * anywhere read its shape.
 */
describe('whether a string is a signature the studio could produce', () => {
  it('accepts a bare code', () => {
    expect(isSignature('KeyP')).toBe(true)
    expect(isSignature('Digit1')).toBe(true)
    expect(isSignature('Space')).toBe(true)
    expect(isSignature('ArrowUp')).toBe(true)
    expect(isSignature('F5')).toBe(true)
    expect(isSignature('BracketLeft')).toBe(true)
    expect(isSignature('NumpadDecimal')).toBe(true)
  })

  /**
   * A guard written as a list of the codes that exist refuses the ones nobody thought of, and a
   * refused code is a key nobody can bind. `IntlBackslash` is the `<>` key of every AZERTY
   * keyboard — the layout this file's own opening paragraph says the codes are here to serve.
   */
  it('accepts the codes a real keyboard emits, listed or not', () => {
    const emitted = [
      'IntlBackslash',
      'IntlRo',
      'IntlYen',
      'ContextMenu',
      'CapsLock',
      'Insert',
      'PrintScreen',
      'Pause',
      'NumLock',
      'AudioVolumeUp',
      'ShiftLeft',
      'MetaRight',
    ]

    for (const code of emitted) expect(isSignature(code), code).toBe(true)
  })

  it('accepts the modifiers in the order `signatureOf` writes them', () => {
    expect(isSignature('Meta+KeyS')).toBe(true)
    expect(isSignature('Ctrl+Alt+Shift+Meta+KeyS')).toBe(true)
    expect(isSignature('Alt+Meta+Delete')).toBe(true)
  })

  /** The defect itself: a letter is what is printed on a key, never the key's position. */
  it('refuses a letter written where a code was meant', () => {
    expect(isSignature('P')).toBe(false)
    expect(isSignature('Meta+P')).toBe(false)
    expect(isSignature('1')).toBe(false)
    expect(isSignature('[')).toBe(false)
  })

  /**
   * Two spellings of one chord would be two different keys in every lookup, and the lookup that
   * decides what a key does is an equality on this string.
   */
  it('refuses the modifiers out of order, or written twice', () => {
    expect(isSignature('Meta+Ctrl+KeyS')).toBe(false)
    expect(isSignature('Shift+Alt+KeyS')).toBe(false)
    expect(isSignature('Meta+Meta+KeyS')).toBe(false)
  })

  it('refuses a modifier that is not one', () => {
    expect(isSignature('Cmd+KeyS')).toBe(false)
    expect(isSignature('Super+KeyS')).toBe(false)
  })

  /** What is not shaped like a code at all: one character, a glyph, a lowercase word. */
  it('refuses what no `KeyboardEvent.code` looks like', () => {
    expect(isSignature('')).toBe(false)
    expect(isSignature('Meta+')).toBe(false)
    expect(isSignature('keyP')).toBe(false)
    expect(isSignature('KEY P')).toBe(false)
    expect(isSignature(null)).toBe(false)
    expect(isSignature(undefined)).toBe(false)
    expect(isSignature(42)).toBe(false)
  })

  /** Whatever `signatureOf` builds must pass: the two describe the same grammar. */
  it('accepts every signature the studio itself builds', () => {
    const chords = [
      { code: 'KeyS', ctrlKey: false, altKey: false, shiftKey: false, metaKey: true },
      { code: 'Escape', ctrlKey: true, altKey: true, shiftKey: true, metaKey: true },
      { code: 'ArrowLeft', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false },
      { code: 'Slash', ctrlKey: false, altKey: false, shiftKey: true, metaKey: false },
      { code: 'IntlBackslash', ctrlKey: false, altKey: false, shiftKey: false, metaKey: true },
    ]

    for (const chord of chords) expect(isSignature(signatureOf(chord))).toBe(true)
  })

  /**
   * The sister table of the registry, in this very file, with the same failure mode: `'W'` where
   * `'KeyW'` was meant would hold no direction and say nothing. It is not remappable today,
   * which is exactly why nothing else would ever read it back.
   */
  it('spells every motion the studio publishes as a signature', () => {
    const malformed = Object.entries(DEFAULT_MOTION).filter(([, bound]) => !isSignature(bound))

    expect(malformed).toEqual([])
  })
})

describe('runsWhileTyping', () => {
  /**
   * The case this answers: a prompt is typed into a node's field, and ⌘Entrée has to reach the
   * graph that runs it. Read off the registry rather than spelled here, so rebinding the command
   * moves the test with it instead of leaving it pinned to a key nobody presses.
   */
  it('lets the chord that runs a graph through from inside a field', () => {
    expect(runsWhileTyping(shipped('graph.run'))).toBe(true)
  })

  it.each(['Meta+KeyS', 'Meta+KeyG', 'Shift+Meta+KeyE', 'Ctrl+Meta+KeyF'])(
    'lets %s through, because a ⌘ is never typing',
    signature => {
      expect(runsWhileTyping(signature)).toBe(true)
    },
  )

  /**
   * What an editable field performs on its own text. Taking these would leave a prompt with no
   * undo and no paste — the one place the user has no other way to ask for them.
   */
  it.each(['Meta+KeyZ', 'Shift+Meta+KeyZ', 'Meta+KeyA', 'Meta+KeyC', 'Meta+KeyV', 'Meta+KeyX'])(
    'leaves %s to the field it was typed in',
    signature => {
      expect(runsWhileTyping(signature)).toBe(false)
    },
  )

  // The general rule is untouched: without a ⌘, a shortcut still yields to what is being typed.
  it.each(['KeyG', 'Delete', 'Shift+KeyE', 'Alt+KeyD', 'Ctrl+KeyZ'])(
    'still yields %s to the field',
    signature => {
      expect(runsWhileTyping(signature)).toBe(false)
    },
  )
})
