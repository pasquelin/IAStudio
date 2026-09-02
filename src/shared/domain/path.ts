/**
 * A run of points and the curve through them — what a rail is, and what a ribbon is swept along.
 *
 * Here rather than in `scene.ts` for the reason `transform.ts` left: `geometry.ts` reads this,
 * and `scene.ts` reads `geometry.ts` — the two together would close the cycle
 * `import-cycles.test.ts` holds at zero.
 */
import type { Vector3 } from './transform'

/**
 * A rail: the line a camera runs along during a shot.
 *
 * `kind` is an open union: a Bézier one would be another value here, and no document written
 * before it would have to be migrated.
 */
export type PathDescriptor = {
  kind: 'catmullrom'
  /** In the node's OWN frame, so moving the rail moves the trajectory. Two at the very least. */
  points: readonly Vector3[]
  closed: boolean
  /** Catmull-Rom tension: 0 is angular, 0.5 is three.js's own default. */
  tension: number
}

export const DEFAULT_PATH: PathDescriptor = Object.freeze({
  kind: 'catmullrom',
  // Five units apart along Z, which is the axis a camera born from the Add menu looks down.
  points: Object.freeze([
    Object.freeze({ x: 0, y: 0, z: 0 }),
    Object.freeze({ x: 0, y: 0, z: -5 }),
  ]),
  closed: false,
  tension: 0.5,
})
