/**
 * The level the three character templates open on — a set built to be WALKED rather than looked
 * at, in the spirit of three.js's `games_fps` example.
 *
 * Everything is a primitive of the studio: a floor with a pit in it, a wall around it, pillars to
 * go round, a ramp and a stair to climb, blocks to jump between, a plank over the drop. What each
 * one is FOR is what says whether it belongs — a scene one cannot fall off, climb or bump into
 * proves nothing about a character controller.
 *
 * No physics reads any of this yet: the shapes are what the player will collide against the day
 * it exists, and what makes a camera at eye height mean something in the meantime.
 */
import type { MaterialDescriptor, Vector3 } from '@shared/domain/scene'
import { groupNode, meshNode, transformAt } from './nodeFactory'
import { defaultMeshMaterial } from './checkerTextures'
import { IDENTITY_TRANSFORM, type SceneNode } from './sceneState'

/** Metres. The dalle is `FLOOR` on a side, with a square hole of `PIT` at its centre. */
const FLOOR = 40
const PIT = 8
const WALL_HEIGHT = 3

/** The slope, in the three numbers that have to agree: its pitch, its half-length, its half-rise. */
const RAMP_PITCH = 0.25
const RAMP_RUN = 4.5
const RAMP_RISE = RAMP_RUN * Math.sin(RAMP_PITCH)

/** A quarter of a metre per checker square is unreadable; one per metre is what a floor wants. */
function tiled(metres: number): MaterialDescriptor {
  return { ...defaultMeshMaterial(), uvScale: Math.max(1, Math.round(metres)) }
}

const LYING_FLAT: Vector3 = { x: -Math.PI / 2, y: 0, z: 0 }

/**
 * The floor, as four bands around a hole — a plane cannot be pierced, and the hole is the whole
 * point: it is what a fall, a jump and the plank across it are tested against.
 */
function floorBands(parentId: string): SceneNode[] {
  const band = (FLOOR - PIT) / 2
  const offset = (PIT + band) / 2

  const slabs: Slab[] = [
    { position: { x: 0, y: 0, z: -offset }, width: FLOOR, depth: band },
    { position: { x: 0, y: 0, z: offset }, width: FLOOR, depth: band },
    { position: { x: -offset, y: 0, z: 0 }, width: band, depth: PIT },
    { position: { x: offset, y: 0, z: 0 }, width: band, depth: PIT },
  ]

  return slabs.map(slab =>
    meshNode(
      { kind: 'plane', width: slab.width, height: slab.depth },
      {
        transform: transformAt(slab.position, LYING_FLAT),
        material: tiled(Math.max(slab.width, slab.depth)),
        castShadow: false,
        parentId,
      },
    ),
  )
}

/** One rectangular part of the set, seen from above. */
type Slab = { position: Vector3; width: number; depth: number }

/** The wall around it. Four boxes rather than one shape: a set is closed by what stops a walk. */
function walls(parentId: string): SceneNode[] {
  const half = FLOOR / 2
  const thickness = 0.4
  const y = WALL_HEIGHT / 2

  const sides: Slab[] = [
    { position: { x: 0, y, z: -half }, width: FLOOR, depth: thickness },
    { position: { x: 0, y, z: half }, width: FLOOR, depth: thickness },
    { position: { x: -half, y, z: 0 }, width: thickness, depth: FLOOR },
    { position: { x: half, y, z: 0 }, width: thickness, depth: FLOOR },
  ]

  return sides.map(side =>
    meshNode(
      { kind: 'box', width: side.width, height: WALL_HEIGHT, depth: side.depth },
      { transform: transformAt(side.position), material: tiled(WALL_HEIGHT), parentId },
    ),
  )
}

/** A ramp and a stair, side by side: the two ways up, and the two a controller handles apart. */
function climbs(parentId: string): SceneNode[] {
  const steps = Array.from({ length: 5 }, (_, at_) =>
    meshNode(
      { kind: 'box', width: 3, height: 0.25, depth: 0.7 },
      {
        transform: transformAt({ x: 12, y: 0.125 + at_ * 0.25, z: 6 - at_ * 0.7 }),
        material: tiled(3),
        parentId,
      },
    ),
  )

  return [
    // Some fourteen degrees, which is a slope one walks up rather than slides down.
    //
    // A POSITIVE pitch about X raises the -Z end, which is the end the landing waits at: the
    // sign was the other way round, and the ramp climbed away from its landing with its foot
    // buried under the floor. The height is what puts that foot back on the ground —
    // `RAMP_RISE` is half the slope's rise, and the centre stands exactly that far up.
    meshNode(
      { kind: 'box', width: 4, height: 0.3, depth: RAMP_RUN * 2 },
      {
        transform: transformAt({ x: -12, y: RAMP_RISE, z: 4 }, { x: RAMP_PITCH, y: 0, z: 0 }),
        material: tiled(RAMP_RUN * 2),
        parentId,
      },
    ),
    // Where the ramp arrives, at the height it arrives AT: a landing half a metre off is a step
    // nobody asked for, and a climb that ends in mid-air is worse.
    meshNode(
      { kind: 'box', width: 4, height: 0.3, depth: 4 },
      {
        transform: transformAt({ x: -12, y: RAMP_RISE * 2, z: -2 }),
        material: tiled(4),
        parentId,
      },
    ),
    ...steps,
  ]
}

/** Three blocks at rising heights, spaced so the gap is the question a jump answers. */
function jumps(parentId: string): SceneNode[] {
  return [0, 1, 2].map(index => {
    const height = 0.5 + index * 0.6

    return meshNode(
      { kind: 'box', width: 2, height, depth: 2 },
      {
        // Clear of `-12`, where the northern floor band is centred: two things at one depth are
        // two things a test cannot tell apart, and a level nobody can describe.
        transform: transformAt({ x: -6 + index * 3.5, y: height / 2, z: -15 }),
        material: tiled(2),
        parentId,
      },
    )
  })
}

/** Pillars to go round, and the plank over the pit — precision rather than speed. */
function obstacles(parentId: string): SceneNode[] {
  const pillars = [
    { x: -7, y: 1.5, z: 7 },
    { x: 7, y: 1.5, z: 10 },
    { x: 10, y: 1.5, z: -8 },
  ].map(position =>
    meshNode(
      { kind: 'cylinder', radiusTop: 0.6, radiusBottom: 0.6, height: 3, segments: 24 },
      { transform: transformAt(position), material: tiled(3), parentId },
    ),
  )

  return [
    ...pillars,
    meshNode(
      { kind: 'box', width: 1.2, height: 0.2, depth: PIT + 0.4 },
      { transform: transformAt({ x: 0, y: -0.1, z: 0 }), material: tiled(PIT), parentId },
    ),
  ]
}

/**
 * The whole set, under one group per family — thirty parts flat in the outliner is a list nobody
 * reads, and the families are also how one hides half the level to look at the other.
 */
export function playgroundNodes(): SceneNode[] {
  const ground = groupNode(IDENTITY_TRANSFORM, 'Ground')
  const enclosure = groupNode(IDENTITY_TRANSFORM, 'Enclosure')
  const course = groupNode(IDENTITY_TRANSFORM, 'Course')

  return [
    ground,
    ...floorBands(ground.id),
    enclosure,
    ...walls(enclosure.id),
    course,
    ...climbs(course.id),
    ...jumps(course.id),
    ...obstacles(course.id),
  ]
}
