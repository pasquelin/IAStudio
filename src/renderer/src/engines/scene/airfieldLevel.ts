// SPDX-License-Identifier: MIT

/**
 * The level the aircraft template opens on: enough ground to read a speed against. An empty plain
 * gives an aeroplane no way to tell a hundred knots from a hover.
 */
import type { Vector3 } from '@shared/domain/scene'
import { groupNode, meshNode, transformAt } from './nodeFactory'
import { surface } from './playgroundLevel'
import { IDENTITY_TRANSFORM, type SceneNode } from './sceneState'

const RUNWAY = { width: 30, depth: 600 }
const HANGAR = { width: 24, depth: 40 }

/** Where the hangars stand, off each side of the strip and along it. */
const HANGAR_X = 60
const HANGAR_Z = [-180, 0, 180]

export function airfieldNodes(): SceneNode[] {
  const field = groupNode(IDENTITY_TRANSFORM, 'Airfield')
  const slab = (at: Vector3, size: { width: number; depth: number }, name: string): SceneNode =>
    meshNode(
      { kind: 'box', width: size.width, height: 0.4, depth: size.depth },
      { transform: transformAt(at), material: surface('#3d4148'), parentId: field.id, name },
    )

  return [
    field,
    slab({ x: 0, y: 0.2, z: 0 }, RUNWAY, 'Runway'),
    ...[-1, 1].flatMap(side =>
      HANGAR_Z.map(z =>
        slab({ x: side * HANGAR_X, y: 4, z }, HANGAR, `Hangar ${side < 0 ? 'West' : 'East'} ${z}`),
      ),
    ),
  ]
}
