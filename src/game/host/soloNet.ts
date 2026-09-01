// SPDX-License-Identifier: MIT

import type { NetPort, Player } from '../ports/netPort'

/** Server and client at once, one player: every branch a networked game takes is reachable. */
export function createSoloNet(player: Player): NetPort {
  // Frozen rather than copied per call: `readonly` is a type, and a script reading this port at
  // runtime has none. Freezing costs nothing on a path a step may take.
  const alone = Object.freeze({ ...player })
  const players = Object.freeze([alone])

  return {
    isServer: () => true,
    isClient: () => true,
    localPlayer: () => alone,
    players: () => players,
  }
}
