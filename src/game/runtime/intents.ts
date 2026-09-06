// SPDX-License-Identifier: MIT

import type { Stick } from '../physics/aerodynamics'

type Steering = { throttle: number; steer: number; handBrake: boolean }

/**
 * What a SCRIPT asks of a body this step, which the built-in controller then carries out — the
 * `AddMovementInput` of this runtime. Shared the way `possessions` is: `script` writes, the three
 * controllers read, and everything is dropped at the top of the next step.
 *
 * 🛑 It REPLACES what the input map said, for that step and that body alone. A script silent on
 * one step hands the sticks back on it; a script that writes every step owns the body. That is
 * what lets one say « stand still » — an intent that only added could never ask for nothing.
 *
 * 🛑 Two exceptions, both in `characters.ts`: a jump ADDS to the button, an impulse having no way
 * to be un-pressed; and there is one look for the world, read for the body the camera watches
 * alone. `walk` and `drive` and `fly` replace, per body.
 *
 * 🛑 Blind spot, written rather than hidden: an ask landing on a body no controller reads — a
 * script on a child mesh, a `drive` from a walker's module — is stored and dropped in SILENCE.
 * Nothing faults, nothing logs, and the author sees a call that does nothing.
 */
export type Intents = {
  walk: (bodyId: string, x: number, z: number) => void
  jump: (bodyId: string) => void
  look: (bodyId: string, yaw: number, pitch: number) => void
  drive: (bodyId: string, throttle: number, steer: number, handBrake: boolean) => void
  fly: (bodyId: string, pitch: number, roll: number, yaw: number, throttle: number) => void

  /** In the shape a STICK speaks: ahead is negative on y, as a stick pushed forward reads. */
  walkOf: (bodyId: string) => { x: number; y: number } | null
  jumped: (bodyId: string) => boolean
  lookOf: (bodyId: string) => { x: number; y: number } | null
  driveOf: (bodyId: string) => Steering | null
  flyOf: (bodyId: string) => Stick | null

  /** Called at the top of each step's scripts: what nobody asked for again is nobody's now. */
  release: () => void
}

export function createIntents(): Intents {
  const walking = new Map<string, { x: number; y: number }>()
  const jumping = new Set<string>()
  const looking = new Map<string, { x: number; y: number }>()
  const driving = new Map<string, Steering>()
  const flying = new Map<string, Stick>()

  return {
    // A script says its z, a stick says its y, and both go the same way — normalised HERE so
    // nothing downstream has to ask which of the two it is reading.
    walk: (bodyId, x, z) => void walking.set(bodyId, { x, y: z }),
    jump: bodyId => void jumping.add(bodyId),
    look: (bodyId, yaw, pitch) => void looking.set(bodyId, { x: yaw, y: pitch }),
    drive: (bodyId, throttle, steer, handBrake) =>
      void driving.set(bodyId, { throttle, steer, handBrake }),
    fly: (bodyId, pitch, roll, yaw, throttle) =>
      void flying.set(bodyId, { pitch, roll, yaw, throttle }),

    walkOf: bodyId => walking.get(bodyId) ?? null,
    jumped: bodyId => jumping.has(bodyId),
    lookOf: bodyId => looking.get(bodyId) ?? null,
    driveOf: bodyId => driving.get(bodyId) ?? null,
    flyOf: bodyId => flying.get(bodyId) ?? null,

    release: () => {
      walking.clear()
      jumping.clear()
      looking.clear()
      driving.clear()
      flying.clear()
    },
  }
}
