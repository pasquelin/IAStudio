import { describe, expect, it } from 'vitest'
import { inputMapOf } from './inputMap'

describe('input maps', () => {
  it('reads a versioned context with typed actions', () => {
    expect(
      inputMapOf({
        version: 1,
        id: 'character',
        priority: 0,
        defaultActive: true,
        actions: [
          { id: 'jump', kind: 'button', bindings: [{ device: 'keyboard', code: 'Space' }] },
          {
            id: 'move',
            kind: 'axis2',
            bindings: [{ device: 'gamepad', control: 'leftStick' }],
          },
        ],
      }),
    ).toEqual({
      version: 1,
      id: 'character',
      priority: 0,
      defaultActive: true,
      actions: [
        { id: 'jump', kind: 'button', bindings: [{ device: 'keyboard', code: 'Space' }] },
        { id: 'move', kind: 'axis2', bindings: [{ device: 'gamepad', control: 'leftStick' }] },
      ],
    })
  })

  it('refuses an axis binding on a button action', () => {
    expect(() =>
      inputMapOf({
        version: 1,
        id: 'character',
        priority: 0,
        defaultActive: true,
        actions: [
          { id: 'jump', kind: 'button', bindings: [{ device: 'gamepad', control: 'leftStick' }] },
        ],
      }),
    ).toThrow()
  })

  it('refuses a single stick axis on a button action', () => {
    expect(() =>
      inputMapOf({
        version: 1,
        id: 'vehicle',
        priority: 0,
        defaultActive: true,
        actions: [
          {
            id: 'accelerate',
            kind: 'button',
            bindings: [{ device: 'gamepad', control: 'leftStickY' }],
          },
        ],
      }),
    ).toThrow()
  })
})
