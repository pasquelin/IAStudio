import { type Box3, Object3D, Vector3 as ThreeVector3 } from 'three'
import './bvhPatches'
import { type ShadowThrow } from './grouping'

/**
 * Which ways the shadows fall, and how low they can land — one direction per CASTING light, read
 * off each light's own target. An empty set answers the origin, and the floor comes from the box
 * the shadow cameras were just fitted to.
 */
export function throwsOf(
  lights: readonly Object3D[],
  bounds: Box3,
  reach: number,
): ShadowThrow | null {
  const along: { x: number; y: number; z: number }[] = []
  for (const light of lights) {
    const target = Reflect.get(light, 'target')
    const at = new ThreeVector3()
    if (target instanceof Object3D) target.getWorldPosition(at)
    const direction = at.sub(light.getWorldPosition(new ThreeVector3())).normalize()
    if (direction.lengthSq() === 0) continue
    along.push({ x: direction.x, y: direction.y, z: direction.z })
  }
  if (along.length === 0) return null
  return { along, floor: bounds.isEmpty() ? 0 : bounds.min.y, reach }
}
