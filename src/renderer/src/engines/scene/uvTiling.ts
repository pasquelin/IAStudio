import type { BufferAttribute, BufferGeometry, InterleavedBufferAttribute } from 'three'
import type { GeometryDescriptor } from '@shared/domain/scene'

/*
 * Repeating a map at a fixed density — one square of the checker per square metre, on a wall as
 * on a floor.
 *
 * A count spread over the whole shape cannot do it: every face of every primitive runs 0..1
 * whatever it measures, so one number gives 1 m per square along a forty-metre band and 0,4 m
 * across the sixteen-metre one beside it. Two halves of one floor then read as two textures.
 *
 * Two ways round it, and which one a shape gets depends on what its own UVs mean:
 *
 * · a shape made of FLAT faces has its UVs recomputed from each vertex's position and normal,
 *   projected on the plane that normal faces. Density is then exact on every face whatever it
 *   measures, and the pattern CONTINUES across an edge instead of restarting at it — which is
 *   what makes a box read as one object rather than six squares.
 *
 * · a surface of REVOLUTION keeps its own UVs, scaled by what they span in metres. Projecting
 *   one would seam it where the dominant axis changes, all round its side.
 *
 * The node's SCALE is not read: a primitive stretched by its transform wears squares stretched
 * with it, which nothing at the geometry level can know about.
 */

/** Metres across, then metres down, that the native UVs of a surface of revolution cover. */
type UvSpan = { u: number; v: number }

export function tileUvs(
  geometry: BufferGeometry,
  descriptor: GeometryDescriptor,
  tilesPerMetre: number,
): void {
  const uv = geometry.attributes.uv
  if (!uv) return

  const span = spanOf(descriptor, geometry)
  if (span) scaleUvs(uv, span, tilesPerMetre)
  else projectUvs(geometry, uv, tilesPerMetre)
}

type UvAttribute = BufferAttribute | InterleavedBufferAttribute

/**
 * `null` for a shape of flat faces, which is projected instead.
 *
 * Exhaustive on purpose rather than defaulting: a kind added to the union has to say which of
 * the two ways it takes, and the compiler is what asks.
 */
function spanOf(descriptor: GeometryDescriptor, geometry: BufferGeometry): UvSpan | null {
  switch (descriptor.kind) {
    case 'box':
    case 'plane':
    case 'circle':
    case 'ring':
    case 'dodecahedron':
    case 'icosahedron':
    case 'octahedron':
    case 'tetrahedron':
      return null

    // Round the side, then down it. The wider end when the two differ: a cone's squares narrow
    // towards its point whatever is done here, and the wide end is the one a person reads.
    case 'cylinder':
      return {
        u: circumference(Math.max(descriptor.radiusTop, descriptor.radiusBottom)),
        v: descriptor.height,
      }

    // Down the sphere is half a turn, not a whole one.
    case 'sphere':
      return { u: circumference(descriptor.radius), v: Math.PI * descriptor.radius }

    // The side plus the two caps, which is the distance a finger travels from pole to pole.
    case 'capsule':
      return {
        u: circumference(descriptor.radius),
        v: descriptor.height + Math.PI * descriptor.radius,
      }

    // `u` runs round the ring, `v` round the tube — the order three.js builds them in.
    case 'torus':
      return { u: circumference(descriptor.radius), v: circumference(descriptor.tube) }

    // The knot winds `p` times round the ring, so its length is that much more than the circle.
    case 'torusKnot':
      return {
        u: circumference(descriptor.radius) * descriptor.p,
        v: circumference(descriptor.tube),
      }

    // The two whose UVs follow a CURVE the descriptor does not carry — a lathe's profile and a
    // tube's path both live in the factory. Measured off the built shape instead, which is an
    // approximation: a path that doubles back is longer than the box it fits in.
    case 'lathe':
    case 'tube':
      return spanFromBounds(geometry)
  }
}

function circumference(radius: number): number {
  return 2 * Math.PI * radius
}

function spanFromBounds(geometry: BufferGeometry): UvSpan {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return { u: 1, v: 1 }

  const width = box.max.x - box.min.x
  const depth = box.max.z - box.min.z
  return { u: circumference(Math.max(width, depth) / 2), v: box.max.y - box.min.y }
}

function scaleUvs(uv: UvAttribute, span: UvSpan, tilesPerMetre: number): void {
  for (let at = 0; at < uv.count; at += 1) {
    uv.setXY(at, uv.getX(at) * span.u * tilesPerMetre, uv.getY(at) * span.v * tilesPerMetre)
  }
  uv.needsUpdate = true
}

function projectUvs(geometry: BufferGeometry, uv: UvAttribute, tilesPerMetre: number): void {
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  if (!position || !normal) return

  for (let at = 0; at < uv.count; at += 1) {
    const x = position.getX(at)
    const y = position.getY(at)
    const z = position.getZ(at)
    const towardsX = Math.abs(normal.getX(at))
    const towardsY = Math.abs(normal.getY(at))
    const towardsZ = Math.abs(normal.getZ(at))

    // The pair the normal does NOT dominate — a floor is read by x and z, a wall facing X by
    // z and y. Ties go to the later axis, which only ever happens on a 45° face.
    if (towardsY >= towardsX && towardsY >= towardsZ) {
      uv.setXY(at, x * tilesPerMetre, z * tilesPerMetre)
    } else if (towardsX >= towardsZ) {
      uv.setXY(at, z * tilesPerMetre, y * tilesPerMetre)
    } else {
      uv.setXY(at, x * tilesPerMetre, y * tilesPerMetre)
    }
  }
  uv.needsUpdate = true
}
