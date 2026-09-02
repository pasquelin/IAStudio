// SPDX-License-Identifier: MIT

import type { Vector3 } from '@shared/domain/transform'
import { clamp } from '../../numeric'
import type { VehicleDrive } from '../../ports/physicsPort'
import { COMPONENT_DEFAULTS } from '../componentDefaults'
import { numberOf } from '../componentFields'
import { componentOf, type Entity } from '../entity'
import type { Pilots } from '../pilots'
import { axesOf, quaternionFromEuler, restingAxes } from '../../physics/quaternion'
import type { System, World } from '../world'

const VEHICLE = COMPONENT_DEFAULTS.Vehicle

const THROTTLE = ['KeyW', 'ArrowUp']
const REVERSE = ['KeyS', 'ArrowDown']
const LEFT = ['KeyA', 'ArrowLeft']
const RIGHT = ['KeyD', 'ArrowRight']
const HAND_BRAKE = 'Space'

/** Metres a second under which a change of direction is taken as a stop rather than a reversal. */
const STOPPED = 0.1

/** Where a chase camera sits behind a car: past its own boot, and low enough to read the road. */
const CHASE_BACK = 9

/**
 * What a car is DRIVEN by: the pedals and the wheel, read off the keyboard and handed to the
 * engine's own suspended vehicle. The wheels themselves are hung by the physics system, which
 * builds the body — this one only ever says what the driver asks.
 *
 * 🛑 The reverse pedal BRAKES while the car still rolls forward, and only reverses once it has
 * stopped. Handed straight through, a car asked to reverse at speed spins its wheels backwards
 * against the road, which reads as a car that will not stop.
 */
export function createVehicleSystem(pilots: Pilots): System {
  const wanted: VehicleDrive[] = []
  const heading = restingAxes()
  const spun = { x: 0, y: 0, z: 0, w: 1 }
  // Kept per vehicle: which way it was last asked to go, which is what tells a brake from a
  // reversal. By ENTITY, like every other system of this tree holds its own state.
  const going = new WeakMap<Entity, number>()

  return {
    name: 'vehicle',
    reads: ['Vehicle'],
    writes: [],

    fixedUpdate: (world: World) => {
      wanted.length = 0
      for (const entity of world.entities.withComponent('Vehicle')) {
        const settings = componentOf(entity, 'Vehicle')
        if (!settings) continue

        const asked = pressed(world, THROTTLE) - pressed(world, REVERSE)
        const last = going.get(entity) ?? 1
        const speed = alongNose(entity, world, heading, spun)
        // Braking while it still rolls the other way; the new direction is taken once stopped.
        const braking = asked * last < 0 && Math.abs(speed) > STOPPED && asked * speed < 0
        if (!braking && asked !== 0) going.set(entity, asked)

        const holding = world.input.held.includes(HAND_BRAKE) ? 1 : 0
        wanted.push({
          body: entity.id,
          forward: braking || holding === 1 ? 0 : asked,
          right: clamp(pressed(world, RIGHT) - pressed(world, LEFT), -1, 1),
          brake: braking ? 1 : 0,
          handBrake: holding,
        })
        // The first one declared is the one the camera rides in, as the first controller is.
        pilots.take(
          {
            entity,
            below: numberOf(settings, 'wheelRadius', VEHICLE.wheelRadius),
            back: CHASE_BACK,
          },
          world.time.tick,
        )
      }

      if (wanted.length > 0) world.ports.physics.drive(wanted)
    },
  }
}

/** How fast it is going along its own nose: forward positive, whatever way the car is pointed. */
function alongNose(
  entity: Entity,
  world: World,
  heading: ReturnType<typeof restingAxes>,
  spun: { x: number; y: number; z: number; w: number },
): number {
  const [motion] = world.ports.physics.motion([entity.id])
  if (!motion) return 0

  axesOf(quaternionFromEuler(entity.transform.rotation, spun), heading)
  return dot(motion.linear, heading.forward)
}

const dot = (one: Vector3, other: Vector3): number =>
  one.x * other.x + one.y * other.y + one.z * other.z

function pressed(world: World, keys: readonly string[]): number {
  for (const key of keys) if (world.input.held.includes(key)) return 1
  return 0
}
