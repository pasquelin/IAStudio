// SPDX-License-Identifier: MIT

import type { InputState } from '../ports/inputPort'

/**
 * 1 when any of `keys` is down. Indexed on both sides rather than `includes`: a character, a car
 * and a plane each read this several times a step, and a closure an allocation each would be the
 * bulk of it.
 */
export function keysHeld(input: InputState, keys: readonly string[]): number {
  for (let key = 0; key < keys.length; key++) {
    for (let held = 0; held < input.held.length; held++) {
      if (input.held[held] === keys[key]) return 1
    }
  }
  return 0
}

export function keyHeld(input: InputState, key: string): number {
  for (let held = 0; held < input.held.length; held++) if (input.held[held] === key) return 1
  return 0
}
