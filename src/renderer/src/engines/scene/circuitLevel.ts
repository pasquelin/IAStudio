// SPDX-License-Identifier: MIT

/**
 * 🛑 Written by its CENTRE LINE, never corner by corner. A track laid as a list of boxes drifts —
 * the kerbs stop matching the tarmac, and a car finds a wall in the middle of a straight.
 */
import type { MaterialDescriptor, Vector3 } from '@shared/domain/scene'
import { groupNode, meshNode, transformAt } from './nodeFactory'
import {
  climbSurface,
  dense,
  fieldNode,
  fixedBody,
  grassSurface,
  groundSurface,
  markSurface,
  obstacleSurface,
} from './levelParts'
import { offsetRun } from './ribbonGeometry'
import { IDENTITY_TRANSFORM, type SceneNode } from './sceneState'

/** Metres. Wide enough for two cars and for a mistake, which is what makes a corner worth taking. */
const TRACK_WIDTH = 12
const TARMAC_DEPTH = 0.2

/** How far the tarmac's top face stands over the ground the car actually rests on. */
const TARMAC_PROUD = 0.03

/** The line is LAID on the tarmac, so its own thickness sits above it rather than half inside. */
const LINE_DEPTH = 0.04

/** Tall enough to stop a car rather than launch it, and thick enough not to be tunnelled through. */
const KERB_HEIGHT = 0.9
const KERB_THICKNESS = 1

/**
 * How many points the loop is drawn through, and how wide it is before the harmonics stretch it.
 * Twenty-four of a 600 m lap is a 25 m chord — short enough to read as a curve.
 */
const MARKS = 24
const BASE_RADIUS = 95

/**
 * 🛑 Metres between squares. The studio default of one turned a 340 m field into noise and a
 * one-metre kerb into a stack of cubes.
 */
const TARMAC_TILE = 5
const KERB_TILE = 3
const GRASS_TILE = 12.5
const PADDOCK_TILE = 2

/** The car starts on the loop itself, at angle zero — the far end of the longest straight. */
export const CIRCUIT_START: Vector3 = { x: 0, y: 0, z: BASE_RADIUS * (1 + 0.34) }

/**
 * 🛑 POLAR, and that is the whole point: a loop written as a list of corners crossed itself six
 * times. A radius that stays positive cannot — every ray from the centre meets it once.
 */
export function circuitLine(atHeight: number): Vector3[] {
  return Array.from({ length: MARKS }, (_, index) => {
    const angle = (index / MARKS) * Math.PI * 2
    // Two harmonics: the second stretches the loop into a long oval, the third breaks its
    // symmetry so no two corners of the lap are taken the same way.
    const radius = BASE_RADIUS * (1 + 0.34 * Math.cos(2 * angle) + 0.16 * Math.sin(3 * angle))
    return { x: Math.sin(angle) * radius, y: atHeight, z: Math.cos(angle) * radius }
  })
}

/**
 * A closed band swept along a run — ONE mesh, mitred at every joint.
 *
 * 🛑 This is what a run of boxes could not be. Laid end to end they leave a wedge at every turn;
 * overlapped to close it, their corners stand proud and the band reads as a staircase.
 */
function ribbonNode(band: {
  points: readonly Vector3[]
  width: number
  height: number
  material: MaterialDescriptor
  parentId: string
  name: string
}): SceneNode {
  return meshNode(
    { kind: 'ribbon', points: band.points, width: band.width, height: band.height, closed: true },
    {
      transform: IDENTITY_TRANSFORM,
      material: band.material,
      parentId: band.parentId,
      name: band.name,
    },
  )
}

/**
 * What stands AROUND the track: one field of grass, a paddock, and a ring of marker posts.
 * 🛑 None of it is felt: a car that clips the scenery is not where a lap is decided.
 */
function surroundings(): SceneNode[] {
  const grounds = groupNode(IDENTITY_TRANSFORM, 'Grounds')

  // ONE field, never the six bands it was: six planes drew six times to say what one says.
  const grass = fieldNode({
    at: { x: 0, y: 0.02, z: 0 },
    width: 340,
    depth: 340,
    material: grassSurface(),
    tilesPerMetre: 1 / GRASS_TILE,
    parentId: grounds.id,
    name: 'Grass',
  })

  // 🛑 Past the WIDEST radius of the loop: placed by eye it stood 6,00 m from the centre line —
  // the edge of the tarmac — and covered nineteen metres of a corner.
  const paddock = meshNode(
    { kind: 'box', width: 46, height: 7, depth: 18 },
    {
      transform: transformAt({ x: 0, y: 3.5, z: BASE_RADIUS * 1.34 + 58 }),
      material: dense(obstacleSurface(), PADDOCK_TILE),
      parentId: grounds.id,
      name: 'Paddock',
    },
  )

  const posts = Array.from({ length: 10 }, (_, index) => {
    const angle = (index / 10) * Math.PI * 2
    return meshNode(
      { kind: 'cylinder', radiusTop: 0.2, radiusBottom: 0.2, height: 4, segments: 8 },
      {
        transform: transformAt({ x: Math.sin(angle) * 162, y: 2, z: Math.cos(angle) * 162 }),
        material: markSurface(),
        parentId: grounds.id,
        name: `Post ${index + 1}`,
      },
    )
  })

  return [grounds, grass, paddock, ...posts]
}

export function circuitNodes(): SceneNode[] {
  const circuit = groupNode(IDENTITY_TRANSFORM, 'Circuit')
  const edge = TRACK_WIDTH / 2 + KERB_THICKNESS / 2

  // 🛑 Nearly SUNK: laid on the ground the car rests on, 57 % of each wheel sat inside the slab;
  // sunk to it exactly, the tarmac could not be seen at all. Three centimetres is both.
  const road = circuitLine(TARMAC_PROUD - TARMAC_DEPTH)

  const kerbs = [-1, 1].map(side =>
    ribbonNode({
      points: offsetRun(circuitLine(0), side * edge, true),
      width: KERB_THICKNESS,
      height: KERB_HEIGHT,
      material: dense(climbSurface(), KERB_TILE),
      parentId: circuit.id,
      name: `Kerb ${side < 0 ? 'Left' : 'Right'}`,
    }),
  )

  return [
    circuit,
    ...surroundings(),
    {
      ...ribbonNode({
        points: road,
        width: TRACK_WIDTH,
        height: TARMAC_DEPTH,
        material: dense(groundSurface(), TARMAC_TILE),
        parentId: circuit.id,
        name: 'Tarmac',
      }),
      // Flat and 250 m across: one shadow texel covers metres there, and what it draws is moiré.
      receiveShadow: false,
      castShadow: false,
    },
    // 🛑 `trimesh`: a closed band is not convex, and its hull is the whole infield — a car would
    // meet a wall the moment it left the grid.
    ...kerbs.map(kerb => ({ ...kerb, components: fixedBody('trimesh') })),
    startLine(circuit.id),
  ]
}

/**
 * 🛑 ACROSS the track, never along it: built from a leg it took the leg's own length and became a
 * thirty-metre slab of chequer. Only the YAW comes from the run.
 */
function startLine(parentId: string): SceneNode {
  const line = circuitLine(0)
  const first = line[0]!
  const next = line[1]!
  const yaw = Math.atan2(next.x - first.x, next.z - first.z)

  return meshNode(
    { kind: 'box', width: TRACK_WIDTH, height: LINE_DEPTH, depth: 1.5 },
    {
      transform: transformAt(
        {
          x: first.x + Math.sin(yaw) * 6,
          y: TARMAC_PROUD + LINE_DEPTH / 2,
          z: first.z + Math.cos(yaw) * 6,
        },
        { x: 0, y: yaw, z: 0 },
      ),
      material: markSurface(),
      parentId,
      name: 'Start Line',
    },
  )
}
