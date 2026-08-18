/**
 * Where something stands, and how it is read back off a file.
 *
 * Apart from `scene.ts`, which re-exports it, for one reason only: a rig holds a rest pose per
 * bone, and `rig.ts` needing this while `scene.ts` needs a `Rig` would close an import cycle —
 * one `import-cycles.test.ts` holds at zero and that neither the compiler nor eslint would see.
 */
import { isRecord } from '../guards'

export type Vector3 = { x: number; y: number; z: number }

export type Transform = {
  position: Vector3
  /** Euler angles, in radians. */
  rotation: Vector3
  scale: Vector3
}

export function isVector3(value: unknown): value is Vector3 {
  if (!isRecord(value)) return false
  return ['x', 'y', 'z'].every(axis => typeof value[axis] === 'number')
}

export function isTransform(value: unknown): value is Transform {
  if (!isRecord(value)) return false
  return isVector3(value.position) && isVector3(value.rotation) && isVector3(value.scale)
}
