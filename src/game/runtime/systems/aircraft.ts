// SPDX-License-Identifier: MIT

import { clamp } from '../../numeric'
import { aeroForces, type Aero, type Airframe, type Stick } from '../../physics/aerodynamics'
import { axesOf, quaternionFromEuler, restingAxes } from '../../physics/quaternion'
import type { BodyForce } from '../../ports/physicsPort'
import { COMPONENT_DEFAULTS } from '../componentDefaults'
import { numberOf } from '../componentFields'
import { componentOf, type Entity } from '../entity'
import type { Pilots } from '../pilots'
import type { System, World } from '../world'

const AIRCRAFT = COMPONENT_DEFAULTS.Aircraft

const NOSE_DOWN = ['KeyW', 'ArrowUp']
const NOSE_UP = ['KeyS', 'ArrowDown']
const ROLL_LEFT = ['KeyA', 'ArrowLeft']
const ROLL_RIGHT = ['KeyD', 'ArrowRight']
const YAW_LEFT = 'KeyQ'
const YAW_RIGHT = 'KeyE'
const THROTTLE_UP = 'ShiftLeft'
const THROTTLE_DOWN = 'ControlLeft'

/** How much of the throttle a second of holding the lever moves — four seconds lever to lever. */
const THROTTLE_RATE = 0.25

/** Where the throttle stands when a plane is put in the air rather than on a runway. */
const CRUISE_THROTTLE = 0.6

/** Where a chase camera sits behind a plane: clear of a nine-metre airframe and its tail. */
const CHASE_BACK = 30

/**
 * What flies: the stick read off the keyboard, and the forces its own motion earns it, pushed
 * into the body every step.
 *
 * 🛑 The throttle is a LEVER, not a pedal: it is held between steps and moved by the keys, because
 * an engine that idles the moment a finger lifts is not something anyone can fly. It lives here
 * rather than in the component — a component is what an author wrote, never what a game is doing.
 */
export function createAircraftSystem(pilots: Pilots): System {
  const throttles = new WeakMap<Entity, number>()
  const forces: BodyForce[] = []
  const names: string[] = []
  const axes = restingAxes()
  const spun = { x: 0, y: 0, z: 0, w: 1 }
  const aero: Aero = { force: { x: 0, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 0 } }

  return {
    name: 'aircraft',
    reads: ['Aircraft'],
    writes: [],

    fixedUpdate: (world: World, dt: number) => {
      forces.length = 0
      names.length = 0
      const flying: Entity[] = []
      for (const entity of world.entities.withComponent('Aircraft')) {
        if (!componentOf(entity, 'Aircraft')) continue
        flying.push(entity)
        names.push(entity.id)
      }
      if (flying.length === 0) return

      const motions = new Map(world.ports.physics.motion(names).map(one => [one.body, one]))
      for (const entity of flying) {
        const settings = componentOf(entity, 'Aircraft')
        const motion = motions.get(entity.id)
        if (!settings || !motion) continue

        const lever = held(world, THROTTLE_UP) - held(world, THROTTLE_DOWN)
        const throttle = clamp(
          (throttles.get(entity) ?? CRUISE_THROTTLE) + lever * THROTTLE_RATE * dt,
          0,
          1,
        )
        throttles.set(entity, throttle)

        const stick: Stick = {
          throttle,
          pitch: pressed(world, NOSE_UP) - pressed(world, NOSE_DOWN),
          roll: pressed(world, ROLL_RIGHT) - pressed(world, ROLL_LEFT),
          yaw: held(world, YAW_RIGHT) - held(world, YAW_LEFT),
        }
        axesOf(quaternionFromEuler(entity.transform.rotation, spun), axes)
        aeroForces(frameOf(settings), stick, axes, motion.linear, motion.angular, aero)
        forces.push({
          body: entity.id,
          force: { ...aero.force },
          torque: { ...aero.torque },
        })
        pilots.take({ entity, below: 0, back: CHASE_BACK }, world.time.tick)
      }

      if (forces.length > 0) world.ports.physics.push(forces)
    },
  }
}

const frameOf = (settings: NonNullable<ReturnType<typeof componentOf>>): Airframe => ({
  maxThrust: numberOf(settings, 'maxThrust', AIRCRAFT.maxThrust),
  wingArea: numberOf(settings, 'wingArea', AIRCRAFT.wingArea),
  stallAngle: numberOf(settings, 'stallAngle', AIRCRAFT.stallAngle),
  agility: numberOf(settings, 'agility', AIRCRAFT.agility),
  drag: numberOf(settings, 'drag', AIRCRAFT.drag),
})

const held = (world: World, key: string): number => (world.input.held.includes(key) ? 1 : 0)

function pressed(world: World, keys: readonly string[]): number {
  for (const key of keys) if (world.input.held.includes(key)) return 1
  return 0
}
