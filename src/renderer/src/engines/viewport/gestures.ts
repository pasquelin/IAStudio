/**
 * Which navigation gesture a button starts — the map Blender, Unity, Unreal and Maya share.
 *
 * `null` leaves the event to whoever else wants it: the right button flies the camera and raises
 * the menu after it, and nothing here may take that.
 */
export type Gesture = 'orbit' | 'pan'

/** The parts of a `PointerEvent` the map reads, so a test never has to build a real one. */
export type GestureButton = {
  button: number
  altKey: boolean
  shiftKey: boolean
}

export function gestureOf({ button, altKey, shiftKey }: GestureButton): Gesture | null {
  if (button === 1) return 'pan'
  if (button !== 0) return null

  // Shift over alt is how Blender pans without a middle button, and the only way a trackpad
  // reaches the gesture the middle button carries everywhere else.
  return altKey && shiftKey ? 'pan' : 'orbit'
}

/**
 * Whether the gesture was NAMED by a modifier rather than fallen into. Only a named one is taken
 * from the rest of the application: a bare left drag still has to reach the picking on release.
 */
export function claimsEvent({ button, altKey }: GestureButton): boolean {
  return button === 1 || altKey
}
