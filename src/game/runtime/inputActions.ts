// SPDX-License-Identifier: MIT

import type { InputMap } from '@shared/domain/inputMap'
import {
  resolveInputMaps,
  type InputActionValue,
  type RawInput,
  type ResolvedInput,
} from './inputMaps'

/**
 * The step's actions, and the EDGE a resolved map cannot carry: `button` answers what is held,
 * so a jump bound to a gamepad button would fire on every step the button stayed down.
 */
export type InputActions = ResolvedInput & {
  pressed: (id: string) => boolean
  released: (id: string) => boolean
}

export type InputActionsReader = InputActions & {
  /** Reads the step's input. Called ONCE a step: it is what the edge is measured against. */
  sample: (maps: readonly InputMap[], active: readonly string[], input: RawInput) => void
}

const NOTHING: RawInput = { held: [], gamepads: [] }

export function createInputActions(): InputActionsReader {
  let current = resolveInputMaps([], [], NOTHING)
  let previous = current

  return {
    sample: (maps, active, input) => {
      previous = current
      current = resolveInputMaps(maps, active, input)
    },
    button: id => current.button(id),
    pressed: id => current.button(id) && !previous.button(id),
    released: id => !current.button(id) && previous.button(id),
    axis: id => current.axis(id),
    axis2: id => current.axis2(id),
    get values(): Readonly<Record<string, InputActionValue>> {
      return current.values
    },
  }
}
