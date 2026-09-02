// SPDX-License-Identifier: MIT

/**
 * The car the vehicle template opens on: a body the physics feels, and four wheels the engine
 * hangs, steers and drives. Everything is a primitive of the studio, so every part stays editable.
 */
import type { MaterialDescriptor, Vector3 } from '@shared/domain/scene'
import { newComponent } from '@shared/domain/componentRegistry'
import { defaultMeshMaterial } from './checkerTextures'
import { meshNode, transformAt } from './nodeFactory'
import type { SceneNode } from './sceneState'

/** Metres. A hatchback: 1,8 across, four long, on 35 cm wheels. */
const HALF_WIDTH = 0.9
const HALF_HEIGHT = 0.3
const HALF_LENGTH = 2
const WHEEL_RADIUS = 0.35
const WHEEL_WIDTH = 0.25

/** Where the axles stand, measured from the body's own centre. */
const AXLE_Z = 1.35
const AXLE_Y = -0.3

/** How high the body is born, so it drops onto its springs rather than through the floor. */
const RIDE_HEIGHT = 1

const WHEEL_NAMES = ['Wheel Front Left', 'Wheel Front Right', 'Wheel Rear Left', 'Wheel Rear Right']

const paint = (color: string): MaterialDescriptor => ({ ...defaultMeshMaterial(), color })

/**
 * 🛑 The wheel nodes are drawn where a wheel RESTS, and `vehicleOf` anchors each suspension one
 * travel above that — an author moves a wheel and the axle follows it, rather than being asked
 * to think about where a spring is bolted.
 *
 * Front is −Z, which is where a node's own forward points: the front pair is what steers.
 */
export function carNodes(at: Vector3, name = 'Car'): SceneNode[] {
  const body = {
    ...meshNode(
      { kind: 'box', width: HALF_WIDTH * 2, height: HALF_HEIGHT * 2, depth: HALF_LENGTH * 2 },
      {
        transform: transformAt({ ...at, y: at.y + RIDE_HEIGHT }),
        material: paint('#c9453d'),
        name,
      },
    ),
    components: [
      newComponent('Collider'),
      { ...newComponent('RigidBody'), mass: 1500 },
      { ...newComponent('Vehicle'), wheels: WHEEL_NAMES.join(', ') },
    ],
  }

  const cabin = meshNode(
    { kind: 'box', width: 1.5, height: 0.6, depth: 2 },
    {
      transform: transformAt({ x: 0, y: HALF_HEIGHT + 0.3, z: 0.2 }),
      material: paint('#2d3038'),
      parentId: body.id,
      name: 'Cabin',
    },
  )

  return [body, cabin, ...WHEEL_NAMES.map(wheel => wheelNode(wheel, body.id))]
}

/**
 * A wheel as the physics turns it: a cylinder about its own +Y, which is the axle Jolt is handed.
 * No component of its own — what moves it is the vehicle its body carries.
 */
function wheelNode(name: string, parentId: string): SceneNode {
  const left = name.endsWith('Left')
  const front = name.includes('Front')

  return meshNode(
    {
      kind: 'cylinder',
      radiusTop: WHEEL_RADIUS,
      radiusBottom: WHEEL_RADIUS,
      height: WHEEL_WIDTH,
      segments: 24,
    },
    {
      transform: transformAt({
        x: left ? -HALF_WIDTH : HALF_WIDTH,
        y: AXLE_Y,
        z: front ? -AXLE_Z : AXLE_Z,
      }),
      material: paint('#26282e'),
      parentId,
      name,
    },
  )
}
