/**
 * Keyboard registry, shared by both processes: the settings window will edit these bindings,
 * and the native menu displays some of them.
 *
 * Everything is keyed on `event.code` — the physical key position. `KeyW KeyA KeyS KeyD` are
 * the same four keys on QWERTY (WASD) and AZERTY (ZQSD), so one table serves both. `event.key`
 * would scatter them.
 */
export type CommandId =
  | 'scene.translate'
  | 'scene.rotate'
  | 'scene.scale'
  | 'scene.frame'
  | 'scene.delete'
  | 'scene.undo'
  | 'scene.redo'
  | 'sequence.playPause'

/** Held keys, read every frame while flying — not fired once like a command. */
export type MotionId = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down' | 'boost'

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

export const COMMAND_IDS: readonly CommandId[] = [
  'scene.translate',
  'scene.rotate',
  'scene.scale',
  'scene.frame',
  'scene.delete',
  'scene.undo',
  'scene.redo',
  'sequence.playPause',
]

export const MOTION_IDS: readonly MotionId[] = [
  'forward',
  'back',
  'left',
  'right',
  'up',
  'down',
  'boost',
]

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
 */
export function shortcutLabel(signature: Signature): string {
  const parts = signature.split('+')
  const code = parts.at(-1) ?? ''
  const modifiers = parts.slice(0, -1).map(part => MODIFIER_GLYPHS[part] ?? part)
  return [...modifiers, code.startsWith('Key') ? code.slice(3) : code].join('')
}

export const DEFAULT_BINDINGS: Record<CommandId, Signature> = {
  'scene.translate': 'KeyG',
  'scene.rotate': 'KeyR',
  'scene.scale': 'KeyS',
  'scene.frame': 'KeyF',
  'scene.delete': 'Delete',
  'scene.undo': 'Meta+KeyZ',
  'scene.redo': 'Shift+Meta+KeyZ',
  'sequence.playPause': 'Space',
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
