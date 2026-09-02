// SPDX-License-Identifier: MIT

import { clamp } from '../../numeric'
import { aeroForces, type Aero, type Airframe, type Stick } from '../../physics/aerodynamics'
import { axesOfEuler, restingAxes } from '../../physics/quaternion'
import type { BodyForce } from '../../ports/physicsPort'
import type { Component } from '@shared/domain/component'
import { COMPONENT_DEFAULTS } from '../componentDefaults'
import { numberOf } from '../componentFields'
import { componentOf, type Entity } from '../entity'
import { keyHeld, keysHeld } from '../keysHeld'
import { PILOT_RANK, type Pilots } from '../pilots'
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
 * 🛑 The throttle is a LEVER held between steps, not a pedal: an engine that idles the moment a
 * finger lifts is not something anyone can fly. It lives here rather than in the component — a
 * component is what an author wrote, never what a game is doing.
 */
export function createAircraftSystem(pilots: Pilots): System {
  const throttles = new WeakMap<Entity, number>()
  const forces: BodyForce[] = []
  const pool: BodyForce[] = []
  const names: string[] = []
  const flying: Entity[] = []
  const settings: Component[] = []
  const axes = restingAxes()
  const stick: Stick = { throttle: 0, pitch: 0, roll: 0, yaw: 0 }
  const frame: Airframe = { maxThrust: 0, wingArea: 0, stallAngle: 0, agility: 0, drag: 0 }
  const aero: Aero = { force: { x: 0, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 0 } }

  return {
    name: 'aircraft',
    reads: ['Aircraft'],
    writes: [],

    fixedUpdate: (world: World, dt: number) => {
      flying.length = 0
      names.length = 0
      settings.length = 0
      for (const entity of world.entities.withComponent('Aircraft')) {
        const held = componentOf(entity, 'Aircraft')
        if (!held) continue
        flying.push(entity)
        settings.push(held)
        names.push(entity.id)
      }
      if (flying.length === 0) return

      // Read ONCE: there is one stick, and every plane in the scene answers it.
      const input = world.input
      stick.pitch = keysHeld(input, NOSE_UP) - keysHeld(input, NOSE_DOWN)
      stick.roll = keysHeld(input, ROLL_RIGHT) - keysHeld(input, ROLL_LEFT)
      stick.yaw = keyHeld(input, YAW_RIGHT) - keyHeld(input, YAW_LEFT)
      const lever = keyHeld(input, THROTTLE_UP) - keyHeld(input, THROTTLE_DOWN)

      forces.length = 0
      const motions = world.ports.physics.motion(names)
      let read = 0
      for (let index = 0; index < flying.length; index++) {
        const entity = flying[index]
        const held = settings[index]
        if (!entity || !held) continue
        // `motion` answers in the order it was asked, leaving out what the port does not hold.
        const motion = motions[read]?.body === entity.id ? motions[read++] : undefined
        if (!motion) continue

        stick.throttle = clamp(
          (throttles.get(entity) ?? CRUISE_THROTTLE) + lever * THROTTLE_RATE * dt,
          0,
          1,
        )
        throttles.set(entity, stick.throttle)
        readFrame(held, frame)
        aeroForces(
          frame,
          stick,
          axesOfEuler(entity.transform.rotation, axes),
          motion.linear,
          motion.angular,
          aero,
        )

        const push = pooled(pool, forces.length)
        push.body = entity.id
        push.force.x = aero.force.x
        push.force.y = aero.force.y
        push.force.z = aero.force.z
        push.torque.x = aero.torque.x
        push.torque.y = aero.torque.y
        push.torque.z = aero.torque.z
        forces.push(push)
        pilots.take(entity, 0, CHASE_BACK, PILOT_RANK.machine, world.time.tick)
      }

      if (forces.length > 0) world.ports.physics.push(forces)
    },
  }
}

function readFrame(settings: Component, into: Airframe): Airframe {
  into.maxThrust = numberOf(settings, 'maxThrust', AIRCRAFT.maxThrust)
  into.wingArea = numberOf(settings, 'wingArea', AIRCRAFT.wingArea)
  into.stallAngle = numberOf(settings, 'stallAngle', AIRCRAFT.stallAngle)
  into.agility = numberOf(settings, 'agility', AIRCRAFT.agility)
  into.drag = numberOf(settings, 'drag', AIRCRAFT.drag)
  return into
}

function pooled(pool: BodyForce[], at: number): BodyForce {
  const kept = pool[at]
  if (kept) return kept

  const made: BodyForce = {
    body: '',
    force: { x: 0, y: 0, z: 0 },
    torque: { x: 0, y: 0, z: 0 },
  }
  pool.push(made)
  return made
}
