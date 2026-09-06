// SPDX-License-Identifier: MIT

import type { InputState } from '../ports/inputPort'
import { createInputActions, type InputActions } from './inputActions'
import type { InputContexts } from './inputContexts'
import type { InputControls } from './inputControls'
import type { RawInput } from './inputMaps'

export type WorldInput = {
  state: () => InputState
  /** Takes the step's reading, and resolves the named actions of it in the same gesture. */
  take: (state: InputState) => void
  actions: InputActions
}

/**
 * 🛑 Resolved where the input is SET rather than inside `step`: a decor that hands the world a
 * reading straight — every controller suite does — would otherwise read actions of an empty map.
 */
export function createWorldInput(
  controls: InputControls,
  contexts: InputContexts,
  initial: InputState,
): WorldInput {
  const actions = createInputActions()
  let held = initial

  return {
    state: () => held,
    take: state => {
      held = state
      actions.sample(controls.maps(), contexts.active(), rawInputOf(state))
    },
    actions,
  }
}

/** What the maps are resolved against: the same reading, without what names no binding. */
function rawInputOf(state: InputState): RawInput {
  return { held: state.held, gamepads: state.gamepads ?? [], pointer: state.pointer }
}
