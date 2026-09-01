import type { BufferAttribute, BufferGeometry, InterleavedBufferAttribute } from 'three'
import type { Transform } from '@shared/domain/transform'
import { matrixOfTransform } from './csgMatrix'

/**
 * A shape moved into the place a brush stands — the geometry MUTATED and handed back.
 *
 * 🛑 A placement of NEGATIVE determinant mirrors the shape, which reverses the winding of every
 * triangle — where `three-bvh-csg` reads inside from outside. A wall dragged through zero on the
 * gizmo, scale -2.13 / -7.83 / -7.79, pierced to 48 triangles of signed volume -127.32 and no
 * hole; wound back, 68 triangles of +122.13, the same two numbers a positive scale gives. The
 * normals need nothing: `applyMatrix4` runs them through the inverse transpose.
 */
export function bakedGeometry(geometry: BufferGeometry, transform: Transform): BufferGeometry {
  const matrix = matrixOfTransform(transform)
  geometry.applyMatrix4(matrix)
  if (matrix.determinant() < 0) flipWinding(geometry)
  return geometry
}

function flipWinding(geometry: BufferGeometry): void {
  const index = geometry.getIndex()
  if (index) {
    for (let at = 0; at + 2 < index.count; at += 3) {
      const middle = index.getX(at + 1)
      index.setX(at + 1, index.getX(at + 2))
      index.setX(at + 2, middle)
    }
    index.needsUpdate = true
    return
  }

  // Every attribute, not the positions alone: a soup with no index carries its normals and its
  // uvs corner by corner, and swapping two corners of one attribute only would tear the others.
  for (const attribute of Object.values(geometry.attributes)) {
    for (let at = 0; at + 2 < attribute.count; at += 3) swapCorners(attribute, at + 1, at + 2)
    attribute.needsUpdate = true
  }
}

function swapCorners(
  attribute: BufferAttribute | InterleavedBufferAttribute,
  one: number,
  other: number,
): void {
  for (let part = 0; part < attribute.itemSize; part += 1) {
    const kept = attribute.getComponent(one, part)
    attribute.setComponent(one, part, attribute.getComponent(other, part))
    attribute.setComponent(other, part, kept)
  }
}
