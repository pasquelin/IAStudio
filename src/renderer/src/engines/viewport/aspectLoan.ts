import type { PerspectiveCamera } from 'three'

/** A pass framing borrowed cameras, and the call that gives every frustum back. */
export type AspectLoan = {
  frame: (camera: PerspectiveCamera) => void
  restore: () => void
}

/**
 * Frames cameras for one pass at `width`×`height`, remembering what each one had.
 *
 * A camera of the scene is shared: the same object draws the film, the corner preview and the
 * frustum a person clicks on. A pass that writes its own aspect and walks away leaves that
 * frustum stretched until the next layout — rendering a 1:1 film would visibly widen the
 * helper drawn under the camera. Each camera is held once, so a film that hands over to a
 * second camera mid-way still restores what the first one came in with.
 */
export function aspectLoan(width: number, height: number): AspectLoan {
  const held = new Map<PerspectiveCamera, number>()
  return {
    frame(camera) {
      if (!held.has(camera)) held.set(camera, camera.aspect)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
    restore() {
      for (const [camera, aspect] of held) {
        camera.aspect = aspect
        camera.updateProjectionMatrix()
      }
      held.clear()
    },
  }
}
