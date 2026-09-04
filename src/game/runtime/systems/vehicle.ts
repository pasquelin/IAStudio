// SPDX-License-Identifier: MIT

import { clamp } from '../../numeric'
import { pooled } from '../../pooled'
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

  const collect = (world: World): void => {
    driving.length = 0
    names.length = 0
    for (const entity of world.entities.withComponent('Vehicle')) {
      if (!componentOf(entity, 'Vehicle')) continue
      driving.push(entity)
      names.push(entity.id)
    }
  }

  const drive = (world: World, asked: number, steer: number, handBrake: number): void => {
    wanted.length = 0
    const motions = world.ports.physics.motion(names)
    let read = 0
    for (const entity of driving) {
      const motion = motions[read]?.body === entity.id ? motions[read++] : undefined
      const turned = (worldOf ? worldOf(entity) : entity.transform).rotation
      const speed = motion ? dot(motion.linear, axesOfEuler(turned, heading).forward) : 0
      const braking = asked * speed < 0 && Math.abs(speed) > STOPPED
      const request = pooled(pool, wanted.length, freshDrive)
      request.body = entity.id
      request.forward = braking || handBrake === 1 ? 0 : asked
      request.steer = steer
      request.brake = braking ? 1 : 0
      request.handBrake = handBrake
      wanted.push(request)
    }
    world.ports.physics.drive(wanted)
  }

  return {
    name: 'vehicle',
    reads: ['Vehicle'],
    writes: [],

    fixedUpdate: (world: World) => {
      collect(world)
      if (driving.length === 0) return
      const input = world.input
      const asked = keysHeld(input, THROTTLE) - keysHeld(input, REVERSE)
      const steer = clamp(keysHeld(input, RIGHT) - keysHeld(input, LEFT), -1, 1)
      const handBrake = keyHeld(input, HAND_BRAKE)
      drive(world, asked, steer, handBrake)
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

const freshDrive = (): VehicleDrive => ({ body: '', forward: 0, steer: 0, brake: 0, handBrake: 0 })
