/**
 * Keyboard registry, shared by both processes: the settings window will edit these bindings,
 * and the native menu displays some of them.
 *
 * Everything is keyed on `event.code` — the physical key position. `KeyW KeyA KeyS KeyD` are
 * the same four keys on QWERTY (WASD) and AZERTY (ZQSD), so one table serves both. `event.key`
 * would scatter them.
 */
/**
 * Which surface a command belongs to. Two spaces legitimately want the same key — `Delete`
 * removes a node in the scene and a clip on the timeline — and only one of them is listening
 * at a time. Without a scope the second binding would be unreachable rather than contextual.
 */
export type CommandScope = 'scene' | 'timeline'

export type CommandId =
  | 'scene.select'
  | 'scene.translate'
  | 'scene.rotate'
  | 'scene.scale'
  | 'scene.frame'
  | 'scene.delete'
  | 'scene.undo'
  | 'scene.redo'
  | 'timeline.playPause'
  | 'timeline.split'
  | 'timeline.delete'
  | 'timeline.zoomIn'
  | 'timeline.zoomOut'
  | 'timeline.fit'
  | 'timeline.start'
  | 'timeline.end'
  | 'timeline.undo'
  | 'timeline.redo'

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

/**
 * A table rather than a prefix read off the id: the compiler then refuses a new command that
 * forgot to say where it lives, which a `startsWith` would silently file under the first scope.
 */
export const COMMAND_SCOPES: Record<CommandId, CommandScope> = {
  'scene.select': 'scene',
  'scene.translate': 'scene',
  'scene.rotate': 'scene',
  'scene.scale': 'scene',
  'scene.frame': 'scene',
  'scene.delete': 'scene',
  'scene.undo': 'scene',
  'scene.redo': 'scene',
  'timeline.playPause': 'timeline',
  'timeline.split': 'timeline',
  'timeline.delete': 'timeline',
  'timeline.zoomIn': 'timeline',
  'timeline.zoomOut': 'timeline',
  'timeline.fit': 'timeline',
  'timeline.start': 'timeline',
  'timeline.end': 'timeline',
  'timeline.undo': 'timeline',
  'timeline.redo': 'timeline',
}

export const COMMAND_IDS: readonly CommandId[] = [
  'scene.select',
  'scene.translate',
  'scene.rotate',
  'scene.scale',
  'scene.frame',
  'scene.delete',
  'scene.undo',
  'scene.redo',
  'timeline.playPause',
  'timeline.split',
  'timeline.delete',
  'timeline.zoomIn',
  'timeline.zoomOut',
  'timeline.fit',
  'timeline.start',
  'timeline.end',
  'timeline.undo',
  'timeline.redo',
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
  // `KeyV` as in every editor that has a pointer tool. Not `KeyQ` or `KeyW`, which fly the
  // camera: `useShortcuts` reads both tables on the same keydown, so one key would do both.
  'scene.select': 'KeyV',
  'scene.translate': 'KeyG',
  'scene.rotate': 'KeyR',
  'scene.scale': 'KeyS',
  'scene.frame': 'KeyF',
  'scene.delete': 'Delete',
  'scene.undo': 'Meta+KeyZ',
  'scene.redo': 'Shift+Meta+KeyZ',

  // Same keys as the scene where the gesture is the same. They only ever reach the surface
  // that is listening, which is what `CommandScope` is for.
  'timeline.playPause': 'Space',
  'timeline.split': 'KeyS',
  'timeline.delete': 'Delete',
  'timeline.zoomIn': 'Meta+Equal',
  'timeline.zoomOut': 'Meta+Minus',
  'timeline.fit': 'Shift+KeyZ',
  'timeline.start': 'Home',
  'timeline.end': 'End',
  'timeline.undo': 'Meta+KeyZ',
  'timeline.redo': 'Shift+Meta+KeyZ',
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
