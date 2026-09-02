// SPDX-License-Identifier: MIT

/**
 * The level the aircraft template opens on: enough ground to read a speed against. An empty plain
 * gives an aeroplane no way to tell a hundred knots from a hover.
 *
 * 🛑 DECOR, and nothing here is solid: the plane meets the scene's own five-metre ground instead —
 * a strip 0,4 m thick is what a machine at sixty metres a second tunnels straight through.
 */
import { groupNode, meshNode, transformAt } from './nodeFactory'
import { surface } from './playgroundLevel'
import { IDENTITY_TRANSFORM, type SceneNode } from './sceneState'

const RUNWAY = { width: 30, height: 0.4, depth: 600 }
const HANGAR = { width: 24, height: 8, depth: 40 }

/** How big a block is, in the three axes a box is written by. */
type Extent = { width: number; height: number; depth: number }

/** Where the hangars stand, off each side of the strip and along it. */
const HANGAR_X = 60
const HANGAR_Z = [-180, 0, 180]

export function airfieldNodes(): SceneNode[] {
  const field = groupNode(IDENTITY_TRANSFORM, 'Airfield')
  // 🛑 The height travels with the size: written into the helper for the runway, it left the six
  // hangars as 0,4 m plates hovering with their undersides at 3,8.
  const block = (x: number, z: number, size: Extent, name: string): SceneNode =>
    meshNode(
      { kind: 'box', ...size },
      {
        // Standing ON the ground, and measured from its own middle.
        transform: transformAt({ x, y: size.height / 2, z }),
        material: surface('#3d4148'),
        parentId: field.id,
        name,
      },
    )

  return [
    field,
    // Sunk so its TOP face is the ground the scene already owns: laid on it, a plane that lands
    // buries 0,4 m of its undercarriage in a strip nothing collides with.
    {
      ...block(0, 0, RUNWAY, 'Runway'),
      transform: transformAt({ x: 0, y: -RUNWAY.height / 2, z: 0 }),
    },
    ...[-1, 1].flatMap(side =>
      HANGAR_Z.map(z =>
        block(side * HANGAR_X, z, HANGAR, `Hangar ${side < 0 ? 'West' : 'East'} ${z}`),
      ),
    ),
  ]
}
