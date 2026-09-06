// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { InputMap } from '@shared/domain/inputMap'
import { createInputActions } from './inputActions'

const MAPS: readonly InputMap[] = [
  {
    version: 1,
    id: 'character',
    priority: 0,
    defaultActive: true,
    actions: [{ id: 'jump', kind: 'button', bindings: [{ device: 'keyboard', code: 'Space' }] }],
  },
]

const holding = (...held: string[]) => ({ held, gamepads: [] })

describe('the actions of a step', () => {
  it('says a button is PRESSED on the step it went down, and never again while it is held', () => {
    const actions = createInputActions()

    actions.sample(MAPS, ['character'], holding())
    actions.sample(MAPS, ['character'], holding('Space'))
    expect(actions.pressed('jump')).toBe(true)
    expect(actions.button('jump')).toBe(true)

    actions.sample(MAPS, ['character'], holding('Space'))
    expect(actions.pressed('jump')).toBe(false)
    expect(actions.button('jump')).toBe(true)
  })

  it('says RELEASED on the step it came up, and nothing before the first sample', () => {
    const actions = createInputActions()
    expect(actions.button('jump')).toBe(false)

    actions.sample(MAPS, ['character'], holding('Space'))
    actions.sample(MAPS, ['character'], holding())

    expect(actions.released('jump')).toBe(true)
    expect(actions.button('jump')).toBe(false)
  })

  it('answers nothing for an action of a context that is not active', () => {
    const actions = createInputActions()

    actions.sample(MAPS, [], holding('Space'))

    expect(actions.button('jump')).toBe(false)
    expect(actions.pressed('jump')).toBe(false)
  })
})
