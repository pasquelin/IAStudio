import { toRadians } from '@shared/domain/angles'
// From the settings, not from `SceneRenderer` whose alias for them put the two in a cycle.
import type { Settings } from '@shared/domain/settings'

/** What a snap step is, for each kind of drag. `null` is how `TransformControls` spells "free". */
export type SnapSteps = {
  translate: number | null
  rotate: number | null
  scale: number | null
}

/**
 * The steps the gizmo is given. How coarse they are is a setting; whether they apply at all is a
 * session thing, which is why the switch is an argument rather than one more field to read.
 *
 * The angle is stored in degrees and turned here — silent to get wrong: fifteen radians is a
 * snap of 859°, which reads as a gizmo that refuses to turn at all.
 */
export function snapSteps(view: Settings['three'], snapping: boolean): SnapSteps {
  if (!snapping) return { translate: null, rotate: null, scale: null }

  return {
    translate: view.snapTranslate,
    rotate: toRadians(view.snapRotate),
    scale: view.snapScale,
  }
}
