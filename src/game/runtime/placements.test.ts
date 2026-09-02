// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { EntityPlacement } from '../ports/renderPort'
import { createGameLoop, STEP_SECONDS } from './gameLoop'
import { placementsOf } from './placements'
import { restingTransform } from './entity'
import type { System, World } from './world'
import { testWorld } from './world-fixtures'

/** A metre of +x a step, and a fifth of a turn about y: something a frame can be caught mid-way. */
const travelling: System = {
  name: 'movement',
  reads: [],
  writes: [],
  fixedUpdate: world => {
    for (const entity of world.entities.all()) {
      entity.transform.position.x += 1
      entity.transform.rotation.y += Math.PI / 5
    }
  },
}

function moving(systems: readonly System[] = [travelling]): World {
  const world = testWorld({ systems })
  world.entities.add({ id: 'crate', name: 'Crate', transform: restingTransform(), components: [] })
  return world
}

describe('what a frame draws between two steps', () => {
  it('draws an entity half way when the frame sits half way', () => {
    const world = moving()
    const into: EntityPlacement[] = []
    world.step(STEP_SECONDS)

    expect(placementsOf(world, into, 0.5)[0]?.transform.position.x).toBeCloseTo(0.5, 6)
    expect(placementsOf(world, into, 1)[0]?.transform.position.x).toBeCloseTo(1, 6)
  })

  /**
   * 🛑 A yaw of 3,1 turning towards −3,1 is a tenth of a turn, not a whole one backwards — blended
   * plainly, a character crossing behind itself spins right round in one frame.
   */
  it('turns the short way round when an angle crosses the half turn', () => {
    const world = moving([])
    const crate = world.entities.get('crate')
    if (crate) crate.transform.rotation.y = Math.PI - 0.1
    world.step(STEP_SECONDS)
    if (crate) crate.transform.rotation.y = -Math.PI + 0.1

    const turned = placementsOf(world, [], 0.5)[0]?.transform.rotation.y ?? 0

    // Half way across the seam, which is just past π rather than back near zero.
    expect(Math.abs(turned)).toBeGreaterThan(Math.PI - 0.01)
  })

  /** Nowhere to come FROM: drawing a newborn at the origin makes it flash across the scene. */
  it('draws an entity born since the last step where it stands', () => {
    const world = moving([])
    world.step(STEP_SECONDS)
    world.entities.add({
      id: 'spark',
      name: 'Spark',
      transform: { ...restingTransform(), position: { x: 7, y: 0, z: 0 } },
      components: [],
    })

    const drawn = placementsOf(world, [], 0.5).find(one => one.entity === 'spark')

    expect(drawn?.transform.position.x).toBe(7)
  })

  /**
   * The whole of the judder: at 120 Hz against a 60 Hz step, one frame in two runs no step, and a
   * picture drawn off the entity's own transform stands still then jumps a whole step.
   */
  it('keeps moving on a frame the loop ran no step on', () => {
    const world = moving()
    const into: EntityPlacement[] = []
    const loop = createGameLoop(world)
    loop.advance(0)

    loop.advance(STEP_SECONDS)
    const stepped = placementsOf(world, into, loop.alpha())[0]?.transform.position.x ?? 0
    loop.advance(STEP_SECONDS * 1.5)
    const between = placementsOf(world, into, loop.alpha())[0]?.transform.position.x ?? 0

    expect(loop.advance(STEP_SECONDS * 1.5)).toBe(0)
    expect(between).toBeGreaterThan(stepped)
  })
})
