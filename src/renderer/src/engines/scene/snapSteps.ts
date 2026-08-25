import { toRadians } from '@shared/domain/angles'
// From the settings, not from `SceneRenderer` whose alias for them put the two in a cycle.
import type { Settings } from '@shared/domain/settings'
import type { Snapping } from '@shared/domain/snap'

/** What a snap step is, for each kind of drag. `null` is how `TransformControls` spells "free". */
export type SnapSteps = {
  translate: number | null
  rotate: number | null
  scale: number | null
}

/**
 * The steps the gizmo is given. How coarse they are is a setting; whether each applies is a
 * session thing, which is why the switches are an argument rather than more fields to read. The
 * surface snap is not here: it lands a drag on something rather than advancing it by an amount.
 *
 * The angle is stored in degrees and turned here — silent to get wrong: fifteen radians is a
 * snap of 859°, which reads as a gizmo that refuses to turn at all.
 */
export function snapSteps(view: Settings['three'], snapping: Snapping): SnapSteps {
  return {
    translate: snapping.translate ? view.snapTranslate : null,
    rotate: snapping.rotate ? toRadians(view.snapRotate) : null,
    scale: snapping.scale ? view.snapScale : null,
  }
}
