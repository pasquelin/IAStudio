// SPDX-License-Identifier: MIT

import type { Vector3 } from '@shared/domain/transform'
import { COMPONENT_DEFAULTS } from '../componentDefaults'
import { componentOf, type Entity } from '../entity'
import { flagOf, numberOf, textOf } from '../componentFields'
import { pointsOf, stepTowards, turnTowards } from '../steering'
import type { System, World } from '../world'

const PATH = COMPONENT_DEFAULTS.Path

/** Where a traveller is on its rail: which point it wants, which way it goes, and whether it is done. */
type Run = { at: number; forward: boolean; done: boolean }

/**
 * What runs along a rail of POINTS at a steady pace — a cart, a dolly shot, a platform on rails.
 *
 * Points rather than named marks, unlike `Patrol`: a rail is a shape, not a set of objects, and an
 * author who moves one of its corners is editing the shape.
 */
export function createPathSystem(): System {
  const runs = new WeakMap<Entity, Run>()
  // Keyed by the WRITTEN rail rather than by the entity: fifty carts on one rail parse it once,
  // and an author editing the string gets a new key rather than a stale list.
  const rails = new Map<string, readonly Vector3[]>()

  return {
    name: 'path',
    reads: ['Path'],
    writes: [],

    fixedUpdate: (world: World, dt: number) => {
      for (const entity of world.entities.withComponent('Path')) {
        const settings = componentOf(entity, 'Path')
        if (!settings) continue

        const said = textOf(settings, 'waypoints', PATH.waypoints)
        const rail = rails.get(said) ?? pointsOf(said)
        rails.set(said, rail)
        if (rail.length === 0) continue

        const run = runs.get(entity) ?? { at: 0, forward: true, done: false }
        runs.set(entity, run)
        if (run.done) continue

        const point = rail[Math.min(run.at, rail.length - 1)]
        if (!point) continue

        if (flagOf(settings, 'orientToTangent', PATH.orientToTangent)) {
          TOWARDS.x = point.x - entity.transform.position.x
          TOWARDS.y = point.y - entity.transform.position.y
          TOWARDS.z = point.z - entity.transform.position.z
          // At once: a rail's tangent is where the cart is ALREADY going, so easing into it would
          // point the cart somewhere it has just left.
          turnTowards(entity.transform.rotation, TOWARDS, 0)
        }

        const reach = numberOf(settings, 'speed', PATH.speed) * dt
        if (!stepTowards(entity.transform.position, point, reach)) continue
        advance(run, rail.length, textOf(settings, 'mode', PATH.mode))
      }
    },
  }
}

/** Reused: a scene of fifty carts allocates nothing at all. */
const TOWARDS: Vector3 = { x: 0, y: 0, z: 0 }

/** `once` stops at the far end; the two others fold the run back, by wrapping or by walking it back. */
function advance(run: Run, count: number, mode: string): void {
  if (mode === 'once') {
    if (run.at + 1 >= count) run.done = true
    else run.at += 1
    return
  }
  if (mode === 'pingPong') {
    if (run.forward && run.at + 1 >= count) run.forward = false
    else if (!run.forward && run.at === 0) run.forward = true
    run.at = Math.max(0, Math.min(count - 1, run.at + (run.forward ? 1 : -1)))
    return
  }

  // loop, and the default.
  run.at = (run.at + 1) % count
}
