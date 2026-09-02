// SPDX-License-Identifier: MIT

import type { Entity } from './entity'

/**
 * What the camera rides in when no character walks: how far under it the ground stands, and how
 * far behind it a chase camera belongs — a nine-metre plane watched from a shoulder is watched
 * from inside its own tail.
 */
type Pilot = { entity: Entity; below: number; back: number }

/**
 * Who the player drives — a car, a plane. Declared by the system that steers it, read by the
 * camera. One seat rather than a `leader()` per system: there is one player, so the two systems
 * compete for it, and the first to claim it in a step keeps it.
 *
 * 🛑 The claim carries the STEP it was made for, and a new step empties the seat. Without that, an
 * entity destroyed mid-game would be framed for ever — a `leader()` here cannot ask the world.
 */
export type Pilots = {
  take: (pilot: Pilot, tick: number) => void
  leader: () => Pilot | null
}

export function createPilots(): Pilots {
  let held: Pilot | null = null
  let at = -1

  return {
    take: (pilot, tick) => {
      if (tick !== at) {
        at = tick
        held = null
      }
      held ??= pilot
    },
    leader: () => held,
  }
}
