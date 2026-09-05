import type { InputMap } from './inputMap'

export type InputPresetId = 'studio' | 'character' | 'vehicle' | 'flight' | 'menu'

export const INPUT_PRESET_IDS: readonly InputPresetId[] = [
  'studio',
  'character',
  'vehicle',
  'flight',
  'menu',
]

const PRESETS: Record<InputPresetId, InputMap> = {
  studio: {
    version: 1,
    id: 'studio',
    priority: 100,
    defaultActive: true,
    actions: [
      { id: 'navigate', kind: 'axis2', bindings: [{ device: 'gamepad', control: 'leftStick' }] },
      {
        id: 'confirm',
        kind: 'button',
        bindings: [{ device: 'gamepad', control: 'south' }],
      },
      { id: 'back', kind: 'button', bindings: [{ device: 'gamepad', control: 'east' }] },
    ],
  },
  character: {
    version: 1,
    id: 'character',
    priority: 0,
    defaultActive: true,
    actions: [
      { id: 'move', kind: 'axis2', bindings: [{ device: 'gamepad', control: 'leftStick' }] },
      { id: 'look', kind: 'axis2', bindings: [{ device: 'gamepad', control: 'rightStick' }] },
      {
        id: 'jump',
        kind: 'button',
        bindings: [
          { device: 'keyboard', code: 'Space' },
          { device: 'gamepad', control: 'south' },
        ],
      },
      {
        id: 'interact',
        kind: 'button',
        bindings: [
          { device: 'keyboard', code: 'KeyE' },
          { device: 'gamepad', control: 'west' },
        ],
      },
    ],
  },
  vehicle: {
    version: 1,
    id: 'vehicle',
    priority: 10,
    defaultActive: false,
    actions: [
      { id: 'steer', kind: 'axis1', bindings: [{ device: 'gamepad', control: 'leftStickX' }] },
      {
        id: 'accelerate',
        kind: 'axis1',
        bindings: [{ device: 'gamepad', control: 'rightTrigger' }],
      },
      { id: 'brake', kind: 'axis1', bindings: [{ device: 'gamepad', control: 'leftTrigger' }] },
      {
        id: 'exit',
        kind: 'button',
        bindings: [
          { device: 'keyboard', code: 'KeyF' },
          { device: 'gamepad', control: 'west' },
        ],
      },
    ],
  },
  flight: {
    version: 1,
    id: 'flight',
    priority: 10,
    defaultActive: false,
    actions: [
      {
        id: 'pitch',
        kind: 'axis1',
        bindings: [{ device: 'gamepad', control: 'leftStickY', invert: true }],
      },
      { id: 'roll', kind: 'axis1', bindings: [{ device: 'gamepad', control: 'leftStickX' }] },
      { id: 'throttle', kind: 'axis1', bindings: [{ device: 'gamepad', control: 'rightTrigger' }] },
    ],
  },
  menu: {
    version: 1,
    id: 'menu',
    priority: 100,
    defaultActive: false,
    actions: [
      {
        id: 'confirm',
        kind: 'button',
        bindings: [
          { device: 'keyboard', code: 'Enter' },
          { device: 'gamepad', control: 'south' },
        ],
      },
      {
        id: 'back',
        kind: 'button',
        bindings: [
          { device: 'keyboard', code: 'Escape' },
          { device: 'gamepad', control: 'east' },
        ],
      },
    ],
  },
}

export function inputMapPreset(id: InputPresetId): InputMap {
  return PRESETS[id]
}
