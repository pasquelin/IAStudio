/** The parts of a `DOMRect` a hit test needs, so a test never has to build a real one. */
export type Bounds = {
  left: number
  top: number
  width: number
  height: number
}

export type PointerPosition = {
  clientX: number
  clientY: number
}

/**
 * Where a pointer sits in normalized device coordinates — `-1` to `+1`, `y` upwards, which is
 * what `Raycaster.setFromCamera` reads.
 *
 * `null` for a zero-sized element rather than an `Infinity` that would send the ray nowhere:
 * a panel that is collapsed or still laying out has no surface to hit.
 */
export function pointerNdc(pointer: PointerPosition, bounds: Bounds): { x: number; y: number } | null {
  if (bounds.width === 0 || bounds.height === 0) return null

  return {
    x: ((pointer.clientX - bounds.left) / bounds.width) * 2 - 1,
    y: -((pointer.clientY - bounds.top) / bounds.height) * 2 + 1,
  }
}
