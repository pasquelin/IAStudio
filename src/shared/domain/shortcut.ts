/**
 * Keyboard registry, shared by both processes: the settings window will edit these bindings,
 * and the native menu displays some of them.
 *
 * Everything is keyed on `event.code` — the physical key position. `KeyW KeyA KeyS KeyD` are
 * the same four keys on QWERTY (WASD) and AZERTY (ZQSD), so one table serves both. `event.key`
 * would scatter them.
 */
/** Held keys, read every frame while flying — not fired once like a command. */
export type MotionId = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down' | 'boost'

export const MOTION_IDS: readonly MotionId[] = [
  'forward',
  'back',
  'left',
  'right',
  'up',
  'down',
  'boost',
]

export type Signature = string

/**
 * What a signature is built from. Spelled out rather than picked from `KeyboardEvent`, which
 * `shared/` cannot name: it compiles without the DOM lib. A real event satisfies it.
 */
export type KeyChord = {
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

/** Fixed modifier order, so one combination always produces one signature. */
export function signatureOf(event: KeyChord): Signature {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')
  parts.push(event.code)
  return parts.join('+')
}

/**
 * The chords the platform also runs on any highlighted text, editable or not.
 *
 * A command bound to one of them steps aside while something is selected: the copy the user
 * meant is the text they just highlighted, and taking it would leave them no way to get it.
 */
const TEXT_CHORDS: ReadonlySet<Signature> = new Set([
  'Meta+KeyC',
  'Meta+KeyX',
  'Ctrl+KeyC',
  'Ctrl+KeyX',
])

export function copiesText(signature: Signature): boolean {
  return TEXT_CHORDS.has(signature)
}

const MODIFIER_GLYPHS: Record<string, string> = {
  Ctrl: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Meta: '⌘',
}

/**
 * Turns a signature into what a tooltip shows — the display counterpart of `signatureOf`.
 * `KeyG` is a position, not a letter, but the letter is what is printed on the key in front of
 * the user, so that is what is displayed.
 *
 * `keyName` names the keys that are words rather than glyphs. It is asked for rather than
 * looked up here because `shared/` has no runtime dependency and so cannot translate: `Space`
 * and `Delete` read as themselves in English, and had been reading as themselves in French too.
 */
export function shortcutLabel(
  signature: Signature | null,
  keyName: (code: NamedKey) => string,
): string {
  // A command may be bound to nothing: listed and searchable, waiting for a key. Its tooltip
  // simply shows no shortcut rather than an empty pair of brackets.
  if (!signature) return ''

  const parts = signature.split('+')
  const code = parts.at(-1) ?? ''
  const modifiers = parts.slice(0, -1).map(part => MODIFIER_GLYPHS[part] ?? part)
  return [...modifiers, keyGlyph(code, keyName)].join('')
}

/**
 * A code is a position, and what is printed on that key is what the user is looking for. The
 * bindings that are neither letters nor named keys — the zoom's `=` and `-`, the guides' `;` —
 * would otherwise read `⌘Equal` in a tooltip and in the shortcuts screen.
 *
 * Arrows are glyphs and not words: they are what the key wears, in every language.
 */
const KEY_GLYPHS: Record<string, string> = {
  Equal: '=',
  Minus: '−',
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

/** The keys whose name is a word, and so differs between languages. */
export type NamedKey =
  | 'Space'
  | 'Enter'
  | 'Escape'
  | 'Delete'
  | 'Backspace'
  | 'Tab'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'

export const NAMED_KEYS: readonly NamedKey[] = [
  'Space',
  'Enter',
  'Escape',
  'Delete',
  'Backspace',
  'Tab',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]

function isNamedKey(code: string): code is NamedKey {
  return NAMED_KEYS.some(candidate => candidate === code)
}

function keyGlyph(code: string, keyName: (code: NamedKey) => string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (isNamedKey(code)) return keyName(code)

  // A key nothing above claims — remapping accepts any code — reads as the code itself, which
  // is still closer to what the user pressed than nothing at all.
  return KEY_GLYPHS[code] ?? code
}

export const DEFAULT_MOTION: Record<MotionId, Signature> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  down: 'KeyQ',
  up: 'KeyE',
  boost: 'ShiftLeft',
}

/**
 * A signature as Electron spells an accelerator. The one place the two vocabularies meet: the
 * native menu used to write `CmdOrCtrl+N` by hand, which is how a remapped command kept showing
 * the key it no longer answered to.
 *
 * `CmdOrCtrl` rather than `Cmd`: `Meta` is the command key on macOS and the Windows key
 * elsewhere, where Ctrl is what people actually press.
 */
const ACCELERATOR_MODIFIERS: Record<string, string> = {
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Meta: 'CmdOrCtrl',
}

/** Keys Electron names differently from `event.code`. Anything else passes through. */
const ACCELERATOR_KEYS: Record<string, string> = {
  Comma: ',',
  Period: '.',
  Equal: '=',
  Minus: '-',
  Slash: '/',
  Backslash: '\\',
  Space: 'Space',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Escape: 'Esc',
  Enter: 'Return',
  Home: 'Home',
  End: 'End',
}

export function acceleratorOf(signature: Signature | null): string | undefined {
  if (!signature) return undefined

  const parts = signature.split('+')
  const code = parts.at(-1) ?? ''
  const modifiers = parts.slice(0, -1).map(part => ACCELERATOR_MODIFIERS[part] ?? part)

  const key = ACCELERATOR_KEYS[code] ?? (code.startsWith('Key') ? code.slice(3) : code)
  return [...modifiers, key].join('+')
}
