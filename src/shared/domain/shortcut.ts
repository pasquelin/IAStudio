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

/**
 * Codes folded onto the key of the same name on the main keyboard, before a signature is built.
 *
 * Folded at the source rather than by giving a command a second binding: a signature is what the
 * registry, the settings file and the shortcuts screen all compare on, and two spellings of one
 * chord would have to agree in all three — a remap would write one of them and the other would
 * go on answering the old key. Here the second spelling never exists.
 *
 * `NumpadEnter` is a distinct position, and the table stays keyed on positions: nothing is
 * renamed, one code is read as another. Only keys whose meaning does not depend on Num Lock
 * belong here — `Numpad1` is `End` with the lock off, so folding it onto `Digit1` would fire a
 * command on a key the user pressed to move the caret.
 */
const CODE_ALIASES: Record<string, string> = {
  NumpadEnter: 'Enter',
}

/** Fixed modifier order, so one combination always produces one signature. */
export function signatureOf(event: KeyChord): Signature {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')
  parts.push(CODE_ALIASES[event.code] ?? event.code)
  return parts.join('+')
}

/**
 * The shape of a whole signature: the modifiers in the one order `signatureOf` writes them,
 * then a `KeyboardEvent.code` — a word, capitalised, of at least two characters.
 *
 * One expression rather than a walk over the parts, and the order is what makes it one: read as
 * a set, `Meta+Ctrl+KeyS` and `Ctrl+Meta+KeyS` would be the same chord under two spellings, and
 * every lookup that decides what a key does is an equality on this string. Written this way a
 * modifier cannot repeat either, which a walk had to rule out on its own.
 *
 * The code is a shape rather than a list of the codes that exist. The two are not the same bet,
 * and the wrong one is expensive in a way the right one is not: a code refused here is a key
 * nobody can bind — `IntlBackslash`, the `<>` of every AZERTY keyboard this studio is aimed at,
 * would have been one — while a code accepted here that no keyboard emits is merely a shortcut
 * that never fires.
 */
const SIGNATURE_SHAPE = /^(Ctrl\+)?(Alt\+)?(Shift\+)?(Meta\+)?[A-Z][A-Za-z0-9]+$/

/**
 * Whether a string is a signature this studio could ever produce.
 *
 * `Signature` is a string, so nothing in the type system stops `'P'` from being written where
 * `'KeyP'` was meant — and sixteen commands were. Typecheck green, lint green, every unit test
 * green: a code is a position and a letter is not one, so the binding simply never fired, and
 * only a test driving a real keyboard caught it.
 *
 * Checked here rather than at each caller: the registry is one user, the recorder on the
 * shortcuts screen is another, and the overrides read off the settings file are a third.
 *
 * A folded code is refused, and that is what makes this more than a shape check. The recorder
 * wrote raw codes before `CODE_ALIASES` existed, so a settings file can hold `NumpadEnter` — a
 * spelling no keypress produces any more. Kept, it would sit on the shortcuts screen naming a
 * key that fires nothing while that same key ran another command. Refused, the schema drops the
 * line and the command goes back to its default, which the keypad does reach.
 */
export function isSignature(value: unknown): value is Signature {
  if (typeof value !== 'string' || !SIGNATURE_SHAPE.test(value)) return false
  return CODE_ALIASES[value.split('+').at(-1) ?? ''] === undefined
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

/**
 * Whether the caret would have a use for the key: writing it, erasing with it, or moving through
 * the words. That is anything a bare key carries, and anything Shift or Alt do — both produce a
 * character on a Mac. Only Ctrl and Meta lift a chord out of the field it is pressed in.
 *
 * Asked by the native menu, which must not reserve such a key with the system: see `keyOf` in
 * `main/menu/template.ts`.
 */
export function typesText(signature: Signature | null): boolean {
  if (!signature) return false
  const modifiers = signature.split('+').slice(0, -1)
  return !modifiers.includes('Ctrl') && !modifiers.includes('Meta')
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
  BracketLeft: '[',
  BracketRight: ']',
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

/**
 * Every key a direction answers to, as a BARE code: motion is matched on `event.code` and never
 * through `signatureOf`, boost being Shift itself. The arrows are a second key for the four of
 * the ground plane, altitude keeping the two letters an arrow could only take from it.
 */
export const DEFAULT_MOTION: Record<MotionId, readonly Signature[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  down: ['KeyQ'],
  up: ['KeyE'],
  boost: ['ShiftLeft'],
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
