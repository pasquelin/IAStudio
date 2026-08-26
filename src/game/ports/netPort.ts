// SPDX-License-Identifier: MIT

export type Player = { id: string; name: string; local: boolean }

/**
 * Who is playing, and on which side. Complete while nothing is networked, and that is the point:
 * a game written against it today becomes a networked one without a call site changing.
 */
export type NetPort = {
  isServer: () => boolean
  isClient: () => boolean
  localPlayer: () => Player
  players: () => readonly Player[]
}
