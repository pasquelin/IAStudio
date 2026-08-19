import { Quaternion, Vector3, type Object3D } from 'three'
import type { LightDescriptor } from '@shared/domain/scene'

/** Reused rather than minted per marker per sync: a scene edit walks every node it touched. */
const HELD = new Vector3()
const TURN = new Quaternion()

/**
 * Where a lamp's marker FACES. Two kinds aim, and neither aims by the rotation of its node:
 * three.js points a `directional` and a `spot` at their target, and lights a `hemisphere` from
 * +Y in world space whatever the node does. The rest have no front at all.
 */
export function aimLightMarker(marker: Object3D, light: LightDescriptor): void {
  if (light.kind === 'directional' || light.kind === 'spot') {
    // `lookAt` on a plain object turns +Z onto the point, which is the way the bodies are built.
    marker.lookAt(light.target.x, light.target.y, light.target.z)
    return
  }

  if (light.kind !== 'hemisphere' || !marker.parent) return

  marker.parent.getWorldQuaternion(TURN)
  marker.quaternion.copy(TURN.invert())
}

/**
 * A marker held at the shape it was built with, whatever scale its node carries. A lamp and a
 * camera have no size of their own, so a stretched node must not stretch what says which is which.
 *
 * Two blind spots, both structural. A local scale is applied BEFORE the marker's own rotation, so
 * a NON-UNIFORM scale under a turned marker leaves a skew that no local scale can undo — only a
 * uniform one cancels exactly. And this runs when the NODE is re-synced: scaling a group does not
 * re-sync what hangs under it, so a lamp inside a stretched group keeps a stale inverse until it
 * is edited.
 */
export function holdMarkerSize(marker: Object3D): void {
  if (!marker.parent) return

  marker.parent.getWorldScale(HELD)
  // An axis typed to zero is reachable from the inspector, and dividing by it writes NaN.
  marker.scale.set(inverseOf(HELD.x), inverseOf(HELD.y), inverseOf(HELD.z))
}

function inverseOf(scale: number): number {
  return scale === 0 ? 1 : 1 / scale
}
