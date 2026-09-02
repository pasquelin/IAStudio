import type { GestureChord, NavigationScheme } from '@shared/domain/navigationPreset'

/**
 * Which navigation gesture a button starts, under the scheme in force.
 *
 * `null` leaves the event to whoever else wants it: the right button flies the camera and raises
 * the menu after it, and nothing here may take that.
 */
export type Gesture = 'orbit' | 'pan'

/** The parts of a `PointerEvent` a chord is read from, so a test never builds a real one. */
export type GestureButton = {
  button: number
  altKey: boolean
  shiftKey: boolean
  ctrlKey?: boolean
}

/**
 * A chord answers on the modifiers it DECLARES and ignores the rest — which is what lets a bare
 * `{ button: 0 }` go on orbiting under the keys that extend a selection. Pan is read first, so a
 * chord that adds a modifier to one of orbit's wins over it.
 */
function matches(chord: GestureChord, event: GestureButton): boolean {
  if (chord.button !== event.button) return false
  if (chord.alt !== undefined && chord.alt !== event.altKey) return false
  if (chord.shift !== undefined && chord.shift !== event.shiftKey) return false
  return chord.ctrl === undefined || chord.ctrl === (event.ctrlKey ?? false)
}

export function gestureOf(event: GestureButton, scheme: NavigationScheme): Gesture | null {
  if (scheme.pan.some(chord => matches(chord, event))) return 'pan'
  return scheme.orbit.some(chord => matches(chord, event)) ? 'orbit' : null
}
