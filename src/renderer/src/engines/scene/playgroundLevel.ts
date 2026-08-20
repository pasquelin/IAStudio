/**
 * The level the three character templates open on — a set built to be WALKED rather than looked
 * at, in the spirit of three.js's `games_fps` example.
 *
 * Everything is a primitive of the studio, so every part stays editable in the outliner and will
 * be what a controller collides against the day one exists. What each part is FOR is what says
 * whether it belongs: a scene one cannot fall into, climb, cross or bump into proves nothing.
 *
 * Every piece is written by its EDGES, never by its centre — see `slab`. Two parts that meet
 * then share the very same constant, which is what stops the four walls overlapping at their
 * corners, a floor hanging over its own edge, and a stair ending half a step short.
 */
import type { CheckerTextureId } from '@shared/domain/checkerTexture'
import type { MaterialDescriptor } from '@shared/domain/scene'
import { defaultMeshMaterial } from './checkerTextures'
import { groupNode, meshNode, transformAt } from './nodeFactory'
import { IDENTITY_TRANSFORM, type SceneNode } from './sceneState'

/** Metres, and the whole set is laid out on a two-metre grid so nothing lands off it. */
const HALF_X = 20
const HALF_Z = 16

/** The floor is a SLAB, not a plane: one sees it from below, and its flanks are what wall the court. */
const FLOOR_DEPTH = 3
const WALL_HEIGHT = 4
const WALL_THICKNESS = 0.5

/** The court sunk into the middle — a drop to fall into, cross over, and climb back out of. */
const COURT_HALF_X = 6
const COURT_HALF_Z = 4
const COURT_FLOOR = -2.5

const TERRACE_HEIGHT = 1.5
const TERRACE_EDGE_X = -8
const TERRACE_EDGE_Z = -10
const WALKWAY_HEIGHT = 3

/**
 * The set is read from the start pad, looking down −Z, and everything is placed against that:
 * the court dead ahead with its plank, the stair out of it to the east, the walkway over it, the
 * terrace and its ramp to the west, the jumps along the north wall.
 */
const START_Z = 10

/** The six planes that bound a block — a part says where it STOPS, and its neighbour starts there. */
type Bounds = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

/**
 * The one placement helper of this file, and the reason the set is exact: nothing here computes
 * a centre by hand, which is the arithmetic that had the four walls overlapping at each corner.
 */
function slab(
  bounds: Bounds,
  name: string,
  material: MaterialDescriptor,
  parentId: string,
): SceneNode {
  return meshNode(
    {
      kind: 'box',
      width: bounds.x1 - bounds.x0,
      height: bounds.y1 - bounds.y0,
      depth: bounds.z1 - bounds.z0,
    },
    {
      transform: transformAt({
        x: (bounds.x0 + bounds.x1) / 2,
        y: (bounds.y0 + bounds.y1) / 2,
        z: (bounds.z0 + bounds.z1) / 2,
      }),
      material,
      parentId,
      name,
    },
  )
}

/**
 * What a part is made of, by its ROLE — the floor one walks, the walls that hold one in, what
 * one climbs, what one goes round. A set of one grey is a set nobody can read at a glance.
 *
 * A fresh descriptor per call, never one shared: a material is part of the node, and two nodes
 * holding the same object would be edited together by accident.
 */
function surface(color: string, texture: CheckerTextureId = 'gridLarge'): MaterialDescriptor {
  return { ...defaultMeshMaterial(texture), color }
}

/** The density is left at the studio default of one everywhere: what changes is WHICH grid. */
const groundSurface = (): MaterialDescriptor => surface('#9aa4b0')
const wallSurface = (): MaterialDescriptor => surface('#6a737f')
const climbSurface = (): MaterialDescriptor => surface('#d08c3a', 'checkerLarge')
const obstacleSurface = (): MaterialDescriptor => surface('#4e5661', 'gridSmall')
const startSurface = (): MaterialDescriptor => surface('#3d7ab8', 'checkerSmall')

/**
 * The floor, as four slabs around the court — a solid cannot be pierced, and the court is the
 * whole point: the flanks of these four are what wall it, so it needs no lining of its own.
 */
function floorSlabs(parentId: string): SceneNode[] {
  const walked = { y0: -FLOOR_DEPTH, y1: 0 }

  const bands: [Bounds, string][] = [
    [{ x0: -HALF_X, x1: HALF_X, z0: -HALF_Z, z1: -COURT_HALF_Z, ...walked }, 'Floor North'],
    [{ x0: -HALF_X, x1: HALF_X, z0: COURT_HALF_Z, z1: HALF_Z, ...walked }, 'Floor South'],
    [
      { x0: -HALF_X, x1: -COURT_HALF_X, z0: -COURT_HALF_Z, z1: COURT_HALF_Z, ...walked },
      'Floor West',
    ],
    [
      { x0: COURT_HALF_X, x1: HALF_X, z0: -COURT_HALF_Z, z1: COURT_HALF_Z, ...walked },
      'Floor East',
    ],
  ]

  return [
    ...bands.map(([bounds, name]) => slab(bounds, name, groundSurface(), parentId)),
    slab(
      {
        x0: -COURT_HALF_X,
        x1: COURT_HALF_X,
        y0: -FLOOR_DEPTH,
        y1: COURT_FLOOR,
        z0: -COURT_HALF_Z,
        z1: COURT_HALF_Z,
      },
      'Court Floor',
      groundSurface(),
      parentId,
    ),
    slab(
      { x0: -1.5, x1: 1.5, y0: 0, y1: 0.05, z0: START_Z - 1.5, z1: START_Z + 1.5 },
      'Start',
      startSurface(),
      parentId,
    ),
  ]
}

/**
 * The wall, INSIDE the edge and mitred at the corners: the two long sides run the full width and
 * the two short ones fit between them. No two overlap, and no face is left coplanar with
 * another — which is what showed as a double seam down every corner.
 */
function walls(parentId: string): SceneNode[] {
  const height = { y0: 0, y1: WALL_HEIGHT }
  const innerX = HALF_X - WALL_THICKNESS
  const innerZ = HALF_Z - WALL_THICKNESS

  const sides: [Bounds, string][] = [
    [{ x0: -HALF_X, x1: HALF_X, z0: -HALF_Z, z1: -innerZ, ...height }, 'Wall North'],
    [{ x0: -HALF_X, x1: HALF_X, z0: innerZ, z1: HALF_Z, ...height }, 'Wall South'],
    [{ x0: -HALF_X, x1: -innerX, z0: -innerZ, z1: innerZ, ...height }, 'Wall West'],
    [{ x0: innerX, x1: HALF_X, z0: -innerZ, z1: innerZ, ...height }, 'Wall East'],
  ]

  return sides.map(([bounds, name]) => slab(bounds, name, wallSurface(), parentId))
}

const STEP_RISE = 0.5
const STEP_RUN = 0.8
const STEP_COUNT = 5

/**
 * The stair out of the court. Solid steps rather than treads on stilts: each is a block from the
 * bottom of the floor up to its own nose, which is both what one sees and what one collides with.
 *
 * The TOP step is the one against the court's edge, where the floor it leads to stands — built
 * the other way round, the climb ended at floor level in mid-court, over the drop.
 */
function courtStair(parentId: string): SceneNode[] {
  return Array.from({ length: STEP_COUNT }, (_, index) => {
    const x1 = COURT_HALF_X - (STEP_COUNT - 1 - index) * STEP_RUN

    return slab(
      {
        x0: x1 - STEP_RUN,
        x1,
        y0: -FLOOR_DEPTH,
        y1: COURT_FLOOR + (index + 1) * STEP_RISE,
        // The southern half of the court, clear of the plank that crosses its middle.
        z0: 1,
        z1: COURT_HALF_Z,
      },
      `Court Step ${index + 1}`,
      climbSurface(),
      parentId,
    )
  })
}

const RAMP_RUN = 6
const RAMP_WIDTH = 3

/**
 * A raised floor along the north wall, and the slope onto it — the two ways up a controller
 * answers differently.
 *
 * A POSITIVE pitch about X raises the -Z end, which is the end the terrace waits at. The centre
 * stands at half the rise, which is what puts the foot of the slope on the floor rather than
 * under it.
 */
function terrace(parentId: string): SceneNode[] {
  return [
    slab(
      {
        x0: -HALF_X + WALL_THICKNESS,
        x1: TERRACE_EDGE_X,
        y0: 0,
        y1: TERRACE_HEIGHT,
        z0: -HALF_Z + WALL_THICKNESS,
        z1: TERRACE_EDGE_Z,
      },
      'Terrace',
      groundSurface(),
      parentId,
    ),
    meshNode(
      { kind: 'box', width: RAMP_WIDTH, height: 0.4, depth: RAMP_RUN },
      {
        transform: transformAt(
          { x: -14, y: TERRACE_HEIGHT / 2, z: TERRACE_EDGE_Z + RAMP_RUN / 2 },
          { x: Math.atan2(TERRACE_HEIGHT, RAMP_RUN), y: 0, z: 0 },
        ),
        material: climbSurface(),
        parentId,
        name: 'Ramp',
      },
    ),
  ]
}

/**
 * A walkway ACROSS the court on two legs — the height a fall is judged from.
 *
 * North of the plank, and never between the start pad and the court: laid there it stood three
 * metres up right in front of where one begins, and hid the whole set behind it.
 */
function walkway(parentId: string): SceneNode[] {
  const legs: [number, string][] = [
    [-COURT_HALF_X - 1.5, 'Walkway Leg West'],
    [COURT_HALF_X + 1.5, 'Walkway Leg East'],
  ]

  return [
    slab(
      { x0: -9, x1: 9, y0: WALKWAY_HEIGHT, y1: WALKWAY_HEIGHT + 0.3, z0: -3.2, z1: -1.6 },
      'Walkway',
      climbSurface(),
      parentId,
    ),
    ...legs.map(([x, name]) =>
      slab(
        { x0: x - 0.3, x1: x + 0.3, y0: 0, y1: WALKWAY_HEIGHT, z0: -3, z1: -1.8 },
        name,
        obstacleSurface(),
        parentId,
      ),
    ),
  ]
}

/** Three blocks at rising heights, the gaps between them widening: the question a jump answers. */
function jumps(parentId: string): SceneNode[] {
  const gaps = [1.5, 2.4, 3.4]
  let x = 3

  return gaps.map((gap, index) => {
    const bounds = { x0: x, x1: x + 2, y0: 0, y1: 0.6 + index * 0.6, z0: -14, z1: -12 }
    x += 2 + gap

    return slab(bounds, `Jump Block ${index + 1}`, climbSurface(), parentId)
  })
}

/** Pillars to go round, and the plank across the court — precision rather than speed. */
function obstacles(parentId: string): SceneNode[] {
  // In the open floor the course leaves free, never in the way of a climb or a jump.
  const pillars: [number, number, string][] = [
    [-14, 6, 'Pillar West'],
    [14, 8, 'Pillar East'],
    [12, -6, 'Pillar North'],
  ]

  return [
    ...pillars.map(([x, z, name]) =>
      meshNode(
        { kind: 'cylinder', radiusTop: 0.6, radiusBottom: 0.6, height: 3.2, segments: 24 },
        { transform: transformAt({ x, y: 1.6, z }), material: obstacleSurface(), parentId, name },
      ),
    ),
    // Flush with the floor it spans, so crossing the court is a matter of aim rather than of a
    // step up. Clear of the stair to its south and of the walkway to its north.
    slab(
      { x0: -COURT_HALF_X, x1: COURT_HALF_X, y0: -0.15, y1: 0, z0: -0.6, z1: 0.6 },
      'Plank',
      climbSurface(),
      parentId,
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
    ...floorSlabs(ground.id),
    enclosure,
    ...walls(enclosure.id),
    course,
    ...courtStair(course.id),
    ...terrace(course.id),
    ...walkway(course.id),
    ...jumps(course.id),
    ...obstacles(course.id),
  ]
}
