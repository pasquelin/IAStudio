// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { InputMap } from '@shared/domain/inputMap'
import { resolveInputMaps } from './inputMaps'

const character: InputMap = {
  version: 1,
  id: 'character',
  priority: 0,
  defaultActive: true,
  actions: [
    { id: 'jump', kind: 'button', bindings: [{ device: 'keyboard', code: 'Space' }] },
    { id: 'move', kind: 'axis2', bindings: [{ device: 'gamepad', control: 'leftStick' }] },
  ],
}

const vehicle: InputMap = {
  version: 1,
  id: 'vehicle',
  priority: 10,
  defaultActive: false,
  actions: [
    { id: 'jump', kind: 'button', bindings: [{ device: 'keyboard', code: 'KeyF' }] },
    { id: 'accelerate', kind: 'axis1', bindings: [{ device: 'gamepad', control: 'rightTrigger' }] },
  ],
}

describe('input mapping contexts', () => {
  it('lets the highest active context own a duplicated action', () => {
    const resolved = resolveInputMaps([character, vehicle], ['character', 'vehicle'], {
      held: ['Space', 'KeyF'],
      gamepads: [],
    })

    expect(resolved.button('jump')).toBe(true)
    expect(resolved.button('accelerate')).toBe(false)
    expect(resolved.axis2('move')).toEqual({ x: 0, y: 0 })
  })

  it('reads a standard gamepad axis with its dead zone removed', () => {
    const resolved = resolveInputMaps([character], ['character'], {
      held: [],
      gamepads: [
        {
          id: 'DualSense',
          index: 0,
          mapping: 'standard',
          axes: [0.1, -0.75],
          buttons: [],
        },
      ],
    })

    expect(resolved.axis2('move')).toEqual({ x: 0, y: -0.75 })
  })

  it('combines keyboard directions into a two-dimensional action', () => {
    const map: InputMap = {
      ...character,
      actions: [
        {
          id: 'move',
          kind: 'axis2',
          bindings: [
            { device: 'keyboard', code: 'KeyA', axis: 'x', scale: -1 },
            { device: 'keyboard', code: 'KeyD', axis: 'x', scale: 1 },
            { device: 'keyboard', code: 'KeyW', axis: 'y', scale: -1 },
          ],
        },
      ],
    }

    const resolved = resolveInputMaps([map], ['character'], {
      held: ['KeyD', 'KeyW'],
      gamepads: [],
    })

    expect(resolved.axis2('move')).toEqual({ x: 1, y: -1 })
  })

  it('reads the primary pointer as a button action', () => {
    const map: InputMap = {
      ...character,
      actions: [
        { id: 'fire', kind: 'button', bindings: [{ device: 'mouse', control: 'primary' }] },
      ],
    }

    const resolved = resolveInputMaps([map], ['character'], {
      held: [],
      gamepads: [],
      pointer: { x: 2, y: 3, down: true },
    })

    expect(resolved.button('fire')).toBe(true)
  })
})
