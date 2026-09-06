// SPDX-License-Identifier: MIT

type Steering = { throttle: number; steer: number; handBrake: boolean }
type Stick = { pitch: number; roll: number; yaw: number; throttle: number }

/**
 * What a SCRIPT asks of a body this step, which the built-in controller then carries out — the
 * `AddMovementInput` of this runtime. Shared the way `possessions` is: `script` writes, the three
 * controllers read, and everything is dropped at the top of the next step.
 *
 * 🛑 It REPLACES what the input map said, for that step and that body alone. A script silent on
 * one step hands the sticks back on it; a script that writes every step owns the body. That is
 * what lets one say « stand still » — an intent that only added could never ask for nothing.
 */
export type Intents = {
  walk: (bodyId: string, x: number, z: number) => void
  jump: (bodyId: string) => void
  look: (bodyId: string, yaw: number, pitch: number) => void
  drive: (bodyId: string, throttle: number, steer: number, handBrake: boolean) => void
  fly: (bodyId: string, pitch: number, roll: number, yaw: number, throttle: number) => void

  walkOf: (bodyId: string) => { x: number; z: number } | null
  jumped: (bodyId: string) => boolean
  lookOf: (bodyId: string) => { x: number; y: number } | null
  driveOf: (bodyId: string) => Steering | null
  flyOf: (bodyId: string) => Stick | null

  /** Called at the top of each step's scripts: what nobody asked for again is nobody's now. */
  release: () => void
}

export function createIntents(): Intents {
  const walking = new Map<string, { x: number; z: number }>()
  const jumping = new Set<string>()
  const looking = new Map<string, { x: number; y: number }>()
  const driving = new Map<string, Steering>()
  const flying = new Map<string, Stick>()

  return {
    walk: (bodyId, x, z) => void walking.set(bodyId, { x, z }),
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
