import type { BufferGeometry, TypedArray } from 'three'

/**
 * The SIGNED volume a triangle soup encloses — the sum of the tetrahedra its faces make with the
 * origin. The only reading that tells a solid from the same solid turned inside out, which is why
 * the CSG tests measure it rather than looking at a picture.
 *
 * Negative means every face is wound the wrong way round; `bakedGeometry` carries what that costs.
 */
export function meshVolume(geometry: BufferGeometry): number {
  const position = geometry.getAttribute('position')
  if (!position) return 0

  // The arrays themselves, not `getX/getY/getZ`: nine accessor calls a triangle measured
  // 0.506 ms on a 32 512-triangle sphere against 0.184 this way, and the election reads one
  // geometry per candidate on the click that folds.
  const points = position.array
  const index = geometry.getIndex()
  if (!index) return sumOf(points, corners => corners, position.count)

  const order = index.array
  return sumOf(points, at => order[at] ?? 0, index.count)
}

function sumOf(points: TypedArray, cornerAt: (at: number) => number, corners: number): number {
  let volume = 0

  for (let at = 0; at + 2 < corners; at += 3) {
    const a = cornerAt(at) * 3
    const b = cornerAt(at + 1) * 3
    const c = cornerAt(at + 2) * 3

    const ax = points[a] ?? 0
    const ay = points[a + 1] ?? 0
    const az = points[a + 2] ?? 0
    const bx = points[b] ?? 0
    const by = points[b + 1] ?? 0
    const bz = points[b + 2] ?? 0
    const cx = points[c] ?? 0
    const cy = points[c + 1] ?? 0
    const cz = points[c + 2] ?? 0

    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
  }

  return volume
}
