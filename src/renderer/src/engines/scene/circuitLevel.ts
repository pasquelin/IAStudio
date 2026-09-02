// SPDX-License-Identifier: MIT

/**
 * 🛑 Written by its CENTRE LINE, never corner by corner. A track laid as a list of boxes drifts —
 * the kerbs stop matching the tarmac, and a car finds a wall in the middle of a straight.
 */
import type { MaterialDescriptor, Vector3 } from '@shared/domain/scene'
import type { CsgGraph, CsgPart } from '@shared/domain/csg'
import { carvedNode, groupNode, meshNode, transformAt } from './nodeFactory'
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
import { IDENTITY_TRANSFORM, type SceneNode } from './sceneState'

/** Metres. Wide enough for two cars and for a mistake, which is what makes a corner worth taking. */
const TRACK_WIDTH = 12
const TARMAC_DEPTH = 0.2

/** How far the tarmac stands over the ground the car actually rests on. */
const TARMAC_PROUD = 0.03

/** The line is LAID on the tarmac, so its own thickness sits above it rather than half inside. */
const LINE_DEPTH = 0.04

/**
 * Stretch per leg END. 🛑 The tightest joint turns 50,4°, not 30°: half the kerb's reach times
 * tan(25,2°) is 3,3 m. At four, that corner's outer kerb had a 2,1 m hole a car drove through.
 */
const JOIN = 7

/** Tall enough to stop a car rather than launch it, and thick enough not to be tunnelled through. */
const KERB_HEIGHT = 0.9
const KERB_THICKNESS = 1

/** Twenty-four legs of a 600 m lap is a 25 m chord — short enough to read as a curve, and the
 * whole loop is welded into one solid, so the count costs no draw call. */
const LEGS = 24
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
export const CIRCUIT_START: Vector3 = {
  x: 0,
  y: 0,
  z: BASE_RADIUS * (1 + 0.34),
}

/** One segment of the centre line — a corner is a run of them, which glues a kerb to its tarmac. */
type Leg = { from: Vector3; to: Vector3 }

const at = (x: number, z: number): Vector3 => ({ x, y: 0, z })

/**
 * 🛑 POLAR, and that is the whole point: a loop written as a list of corners crossed itself six
 * times. A radius that stays positive cannot — every ray from the centre meets it once.
 */
function centreLine(): Leg[] {
  const marks = Array.from({ length: LEGS }, (_, index) => {
    const angle = (index / LEGS) * Math.PI * 2
    // Two harmonics: the second stretches the loop into a long oval, the third breaks its
    // symmetry so no two corners of the lap are taken the same way.
    const radius = BASE_RADIUS * (1 + 0.34 * Math.cos(2 * angle) + 0.16 * Math.sin(3 * angle))
    return at(Math.sin(angle) * radius, Math.cos(angle) * radius)
  })

  return marks.map((from, index) => ({ from, to: marks[(index + 1) % marks.length]! }))
}

/**
 * 🛑 Stretched by `JOIN` at both ends, never by the WIDTH: a hairpin chord is 5,6 m long, and
 * stretched by the track's own 12 m it became a 17,6 m box piled across the corner it bordered.
 */
function alongLeg(
  leg: Leg,
  size: { width: number; height: number; y: number },
  offset: number,
  material: MaterialDescriptor,
  name: string,
): CsgPart {
  const dx = leg.to.x - leg.from.x
  const dz = leg.to.z - leg.from.z
  const yaw = Math.atan2(dx, dz)
  // Pushed off the centre line by `offset`, along the leg's own normal.
  const acrossX = Math.cos(yaw)
  const acrossZ = -Math.sin(yaw)

  return {
    name,
    geometry: {
      kind: 'box',
      width: size.width,
      height: size.height,
      depth: Math.hypot(dx, dz) + JOIN,
    },
    transform: transformAt(
      {
        x: (leg.from.x + leg.to.x) / 2 + acrossX * offset,
        y: size.y,
        z: (leg.from.z + leg.to.z) / 2 + acrossZ * offset,
      },
      { x: 0, y: yaw, z: 0 },
    ),
    material,
  }
}

/** One solid out of a run of brushes: one draw call, and no joint left to read as a step. */
function weld(parts: readonly CsgPart[], collision: CsgGraph['collision']): CsgGraph {
  const [first, ...rest] = parts
  // 🛑 Thrown rather than defaulted: a level that silently drew no track would be green
  // everywhere, and every run below is a fixed count.
  if (!first) throw new Error('a solid cannot be welded out of nothing')
  return { base: first, steps: rest.map(part => ({ operation: 'unite', part })), collision }
}

/** 🛑 None of it is felt: a car that clips the scenery is not where a lap is decided. */
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
    return {
      name: `Post ${index + 1}`,
      geometry: { kind: 'cylinder', radiusTop: 0.2, radiusBottom: 0.2, height: 4, segments: 8 },
      transform: transformAt({ x: Math.sin(angle) * 162, y: 2, z: Math.cos(angle) * 162 }),
      material: markSurface(),
    } satisfies CsgPart
  })

  return [
    grounds,
    grass,
    paddock,
    // One solid for the ten: below `WORTH_INSTANCING` nothing groups them, so ten posts were ten
    // draw calls to say one thing.
    carvedNode(weld(posts, 'box'), {
      material: markSurface(),
      parentId: grounds.id,
      name: 'Posts',
    }),
  ]
}

export function circuitNodes(): SceneNode[] {
  const circuit = groupNode(IDENTITY_TRANSFORM, 'Circuit')
  const legs = centreLine()
  const tarmac = dense(groundSurface(), TARMAC_TILE)
  const kerb = dense(climbSurface(), KERB_TILE)
  const edge = TRACK_WIDTH / 2 + KERB_THICKNESS / 2

  // 🛑 Nearly SUNK: laid on the ground the car rests on, 57 % of each wheel sat inside the slab;
  // sunk to it exactly, the tarmac could not be seen at all. Three centimetres is both.
  const road = weld(
    legs.map((leg, index) =>
      alongLeg(
        leg,
        { width: TRACK_WIDTH, height: TARMAC_DEPTH, y: TARMAC_PROUD - TARMAC_DEPTH / 2 },
        0,
        tarmac,
        `Tarmac ${index + 1}`,
      ),
    ),
    // Never read: the tarmac is decor, and the car rests on the scene's own ground.
    'box',
  )

  const nodes: SceneNode[] = [
    circuit,
    ...surroundings(),
    {
      ...carvedNode(road, { material: tarmac, parentId: circuit.id, name: 'Tarmac' }),
      // Flat and 250 m across: one shadow texel covers metres there, and what it draws is moiré.
      receiveShadow: false,
      castShadow: false,
    },
  ]

  // 🛑 ONE solid a side, not twenty-four boxes: a run of blocks reads as stacked cubes, and the
  // union welds their shared faces away. Measured 107 ms and 122 ms, cached after.
  for (const side of [-1, 1]) {
    const rail = weld(
      legs.map((leg, index) =>
        alongLeg(
          leg,
          { width: KERB_THICKNESS, height: KERB_HEIGHT, y: KERB_HEIGHT / 2 },
          side * edge,
          kerb,
          `Kerb ${index + 1}`,
        ),
      ),
      'convexes',
    )
    nodes.push({
      ...carvedNode(rail, {
        material: kerb,
        parentId: circuit.id,
        name: `Kerb ${side < 0 ? 'Left' : 'Right'}`,
      }),
      components: fixedBody(),
    })
  }

  // 🛑 ACROSS the track, never along it: built from a leg it took the leg's own length and
  // became a thirty-metre slab of chequer. Only the YAW comes from the leg.
  const first = legs[0]
  if (first) {
    const yaw = Math.atan2(first.to.x - first.from.x, first.to.z - first.from.z)
    nodes.push(
      meshNode(
        { kind: 'box', width: TRACK_WIDTH, height: LINE_DEPTH, depth: 1.5 },
        {
          transform: transformAt(
            {
              x: first.from.x + Math.sin(yaw) * 6,
              y: TARMAC_PROUD + LINE_DEPTH / 2,
              z: first.from.z + Math.cos(yaw) * 6,
            },
            { x: 0, y: yaw, z: 0 },
          ),
          material: markSurface(),
          parentId: circuit.id,
          name: 'Start Line',
        },
      ),
    )
  }

  return nodes
}
