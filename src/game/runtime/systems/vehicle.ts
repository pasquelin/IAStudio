// SPDX-License-Identifier: MIT

import { clamp } from '../../numeric'
import { axesOfEuler, dot, restingAxes } from '../../physics/quaternion'
import type { VehicleDrive } from '../../ports/physicsPort'
import { COMPONENT_DEFAULTS } from '../componentDefaults'
import { numberOf } from '../componentFields'
import type { Transform } from '@shared/domain/transform'
import { componentOf, type Entity } from '../entity'
import { keyHeld, keysHeld } from '../keysHeld'
import { PILOT_RANK, type Pilots } from '../pilots'
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
 * 🛑 The reverse pedal BRAKES while the car still rolls forward, and only reverses once it has
 * stopped. Handed straight through, a car asked to reverse at speed spins its wheels backwards
 * against the road, which reads as a car that will not stop.
 */
export function createVehicleSystem(
  pilots: Pilots,
  worldOf?: (entity: Entity) => Transform,
): System {
  const wanted: VehicleDrive[] = []
  const pool: VehicleDrive[] = []
  const names: string[] = []
  const driving: Entity[] = []
  const heading = restingAxes()

  return {
    name: 'vehicle',
    reads: ['Vehicle'],
    writes: [],

    fixedUpdate: (world: World) => {
      driving.length = 0
      names.length = 0
      for (const entity of world.entities.withComponent('Vehicle')) {
        if (!componentOf(entity, 'Vehicle')) continue
        driving.push(entity)
        names.push(entity.id)
      }
      if (driving.length === 0) return

      // Read ONCE: there is one keyboard, and every car in the scene answers the same pedals.
      const input = world.input
      const asked = keysHeld(input, THROTTLE) - keysHeld(input, REVERSE)
      const steer = clamp(keysHeld(input, RIGHT) - keysHeld(input, LEFT), -1, 1)
      const handBrake = keyHeld(input, HAND_BRAKE)

      wanted.length = 0
      const motions = world.ports.physics.motion(names)
      let read = 0
      for (const entity of driving) {
        // `motion` answers in the order it was asked, leaving out what the port does not hold.
        const motion = motions[read]?.body === entity.id ? motions[read++] : undefined
        // 🛑 The WORLD rotation: the forces and the velocity are world-space, and a car hanging
        // from a rotated group carries a local one — its nose would point in the parent's frame.
        const turned = (worldOf ? worldOf(entity) : entity.transform).rotation
        const speed = motion ? dot(motion.linear, axesOfEuler(turned, heading).forward) : 0
        const braking = asked * speed < 0 && Math.abs(speed) > STOPPED

        const drive = pooled(pool, wanted.length)
        drive.body = entity.id
        drive.forward = braking || handBrake === 1 ? 0 : asked
        drive.steer = steer
        drive.brake = braking ? 1 : 0
        drive.handBrake = handBrake
        wanted.push(drive)
      }

      world.ports.physics.drive(wanted)
    },

    /**
     * 🛑 The seat is claimed at the IMAGE, never at the step: `playCamera` releases it every frame,
     * so a frame the accumulator ran no step of left a driven car with no view at all while it was
     * being drawn interpolated.
     */
    lateUpdate: (world: World) => {
      for (const entity of world.entities.withComponent('Vehicle')) {
        const settings = componentOf(entity, 'Vehicle')
        if (!settings) continue

        const wheelRadius = numberOf(settings, 'wheelRadius', VEHICLE.wheelRadius)
        pilots.take(entity, wheelRadius, CHASE_BACK, PILOT_RANK.machine)
      }
    },
  }
}

function pooled(pool: VehicleDrive[], at: number): VehicleDrive {
  const kept = pool[at]
  if (kept) return kept

  const made: VehicleDrive = { body: '', forward: 0, steer: 0, brake: 0, handBrake: 0 }
  pool.push(made)
  return made
}
