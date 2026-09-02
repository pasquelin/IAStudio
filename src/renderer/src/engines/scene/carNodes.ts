// SPDX-License-Identifier: MIT

/**
 * The car the vehicle template opens on: a body the physics feels, and four wheels the engine
 * hangs, steers and drives. Everything is a primitive of the studio, so every part stays editable.
 */
import type { Vector3 } from '@shared/domain/scene'
import { newComponent } from '@shared/domain/componentRegistry'
import { meshNode, transformAt } from './nodeFactory'
import { surface } from './playgroundLevel'
import type { SceneNode } from './sceneState'

/** Metres. A hatchback: 1,8 across, four long, on 35 cm wheels. */
const HALF_WIDTH = 0.9
const HALF_HEIGHT = 0.3
const HALF_LENGTH = 2
const WHEEL_RADIUS = 0.35
const WHEEL_WIDTH = 0.25

/** Where the axles stand, measured from the body's own centre. */
const AXLE_Z = 1.35
const AXLE_Y = -0.35

/** Where the body stands when its wheels touch: the axle's own depth plus a wheel's radius. */
const RIDE_HEIGHT = WHEEL_RADIUS - AXLE_Y

/**
 * Front is −Z, which is where a node's own forward points: the front pair is what steers.
 *
 * 🛑 Named AFTER the car, never `Wheel Front Left` bare: `vehicleOf` resolves a wheel by the
 * first entity wearing that name, so two cars in one scene both bound to the first one's wheels
 * and the second drew none of its own.
 */
const WHEELS = [
  { corner: 'Wheel Front Left', x: -HALF_WIDTH, z: -AXLE_Z },
  { corner: 'Wheel Front Right', x: HALF_WIDTH, z: -AXLE_Z },
  { corner: 'Wheel Rear Left', x: -HALF_WIDTH, z: AXLE_Z },
  { corner: 'Wheel Rear Right', x: HALF_WIDTH, z: AXLE_Z },
]

const wheelName = (car: string, corner: string): string => `${car} ${corner}`

/** The wheel nodes are drawn where a wheel RESTS; the engine anchors each spring above that. */
export function carNodes(at: Vector3, name = 'Car'): SceneNode[] {
  const body = {
    ...meshNode(
      { kind: 'box', width: HALF_WIDTH * 2, height: HALF_HEIGHT * 2, depth: HALF_LENGTH * 2 },
      {
        transform: transformAt({ ...at, y: at.y + RIDE_HEIGHT }),
        material: surface('#c9453d'),
        name,
      },
    ),
    components: [
      newComponent('Collider'),
      { ...newComponent('RigidBody'), mass: 1500 },
      { ...newComponent('Vehicle'), wheels: WHEELS.map(w => wheelName(name, w.corner)).join(', ') },
    ],
  }

  const cabin = meshNode(
    { kind: 'box', width: 1.5, height: 0.6, depth: 2 },
    {
      transform: transformAt({ x: 0, y: HALF_HEIGHT + 0.3, z: 0.2 }),
      material: surface('#2d3038'),
      parentId: body.id,
      name: 'Cabin',
    },
  )

  return [body, cabin, ...WHEELS.map(wheel => wheelNode(wheel, name, body.id))]
}

/**
 * A wheel as the physics turns it: a cylinder about its own +Y, which is the axle Jolt is handed.
 * No component of its own — what moves it is the vehicle its body carries.
 *
 * 🛑 Laid on its side at REST, and only at rest: Play overwrites the pose every step, so without
 * this the thumbnail and everything before the first step showed four flat discs.
 */
function wheelNode(wheel: (typeof WHEELS)[number], car: string, parentId: string): SceneNode {
  return meshNode(
    {
      kind: 'cylinder',
      radiusTop: WHEEL_RADIUS,
      radiusBottom: WHEEL_RADIUS,
      height: WHEEL_WIDTH,
      segments: 24,
    },
    {
      transform: transformAt({ x: wheel.x, y: AXLE_Y, z: wheel.z }, { x: 0, y: 0, z: Math.PI / 2 }),
      material: surface('#26282e'),
      parentId,
      name: wheelName(car, wheel.corner),
    },
  )
}
