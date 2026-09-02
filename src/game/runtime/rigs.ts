// SPDX-License-Identifier: MIT

import type { Entity } from './entity'

/**
 * The camera node a spring arm drives, handed from `springArm` to the system that films.
 * 🛑 The FIRST arm of the sweep wins: an author with two turns one off by clearing its `camera`.
 */
export type Rigs = {
  take: (camera: Entity) => void
  leader: () => Entity | null
  /** Emptied once the shot is composed, so an arm destroyed mid-game stops being filmed. */
  release: () => void
}

export function createRigs(): Rigs {
  let held: Entity | null = null

  return {
    take: camera => {
      held ??= camera
    },
    leader: () => held,
    release: () => {
      held = null
    },
  }
}
