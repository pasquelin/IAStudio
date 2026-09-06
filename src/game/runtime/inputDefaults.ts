// SPDX-License-Identifier: MIT

import type { InputMap, KeyboardBinding } from '@shared/domain/inputMap'

/**
 * The contexts a scene plays with when the project declares none of its own — what makes a
 * gamepad and a keyboard reach the built-in controllers with no file and no script.
 *
 * 🛑 COPIED from `@shared/domain/inputPresets`, because this tree is MIT and ships without the
 * rest: a VALUE taken from `@shared/` would carry PolyForm code into an exported game. Held to
 * the originals by `inputDefaults.test.ts`, which ships nowhere and may read both.
 */
/** The four keys and the four arrows a walker and a machine both answer, as one half-axis each. */
function keyAxis(negative: readonly string[], positive: readonly string[]): KeyboardBinding[] {
  return [
    ...negative.map((code): KeyboardBinding => ({ device: 'keyboard', code, scale: -1 })),
    ...positive.map((code): KeyboardBinding => ({ device: 'keyboard', code, scale: 1 })),
  ]
}

function keyVector(
  negative: readonly string[],
  positive: readonly string[],
  axis: 'x' | 'y',
): KeyboardBinding[] {
  return keyAxis(negative, positive).map(binding => ({ ...binding, axis }))
}

const LEFT = ['KeyA', 'ArrowLeft']
const RIGHT = ['KeyD', 'ArrowRight']
const AHEAD = ['KeyW', 'ArrowUp']
const BACK = ['KeyS', 'ArrowDown']

const DEFAULTS: readonly InputMap[] = [
  {
    version: 1,
    id: 'character',
    priority: 0,
    defaultActive: true,
    actions: [
      {
        id: 'move',
        kind: 'axis2',
        bindings: [
          ...keyVector(LEFT, RIGHT, 'x'),
          // Ahead is NEGATIVE on y, which is what a stick pushed forward reads — `paceInto` turns
          // it back the once.
          ...keyVector(AHEAD, BACK, 'y'),
          { device: 'gamepad', control: 'leftStick' },
        ],
      },
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
        id: 'run',
        kind: 'button',
        bindings: [
          { device: 'keyboard', code: 'ShiftLeft' },
          { device: 'keyboard', code: 'ShiftRight' },
          { device: 'gamepad', control: 'leftStickButton' },
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
  {
    version: 1,
    id: 'vehicle',
    priority: 10,
    // Active with `character`: no action name is shared, and a driver's body walks nowhere while
    // it is being carried — see `possession.ts`.
    defaultActive: true,
    actions: [
      {
        id: 'steer',
        kind: 'axis1',
        bindings: [...keyAxis(LEFT, RIGHT), { device: 'gamepad', control: 'leftStickX' }],
      },
      {
        id: 'accelerate',
        kind: 'axis1',
        bindings: [
          ...AHEAD.map((code): KeyboardBinding => ({ device: 'keyboard', code, scale: 1 })),
          { device: 'gamepad', control: 'rightTrigger' },
        ],
      },
      {
        id: 'brake',
        kind: 'axis1',
        bindings: [
          ...BACK.map((code): KeyboardBinding => ({ device: 'keyboard', code, scale: 1 })),
          { device: 'gamepad', control: 'leftTrigger' },
        ],
      },
      {
        id: 'handBrake',
        kind: 'button',
        bindings: [
          { device: 'keyboard', code: 'Space' },
          { device: 'gamepad', control: 'south' },
        ],
      },
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
  {
    version: 1,
    id: 'flight',
    priority: 10,
    defaultActive: true,
    actions: [
      // Pulled back is nose UP, which is what the arrows already said and what a stick pulled
      // towards the pilot reads as: positive y, no inversion.
      {
        id: 'pitch',
        kind: 'axis1',
        bindings: [...keyAxis(AHEAD, BACK), { device: 'gamepad', control: 'leftStickY' }],
      },
      {
        id: 'roll',
        kind: 'axis1',
        bindings: [...keyAxis(LEFT, RIGHT), { device: 'gamepad', control: 'leftStickX' }],
      },
      {
        id: 'yaw',
        kind: 'axis1',
        bindings: [
          ...keyAxis(['KeyQ'], ['KeyE']),
          { device: 'gamepad', control: 'leftShoulder', scale: -1 },
          { device: 'gamepad', control: 'rightShoulder', scale: 1 },
        ],
      },
      // A RATE, not a position: the lever is nudged up and down and stays where it was left,
      // which is what the keyboard already did and what a trigger held forward now does too.
      {
        id: 'throttle',
        kind: 'axis1',
        bindings: [
          ...keyAxis(['ControlLeft'], ['ShiftLeft']),
          { device: 'gamepad', control: 'leftTrigger', scale: -1 },
          { device: 'gamepad', control: 'rightTrigger', scale: 1 },
        ],
      },
    ],
  },
]

/** The maps given, completed by the defaults they leave undefined. What is given always wins. */
export function withDefaultInputMaps(maps: readonly InputMap[]): readonly InputMap[] {
  const declared = new Set(maps.map(map => map.id))
  return [
    ...maps,
    ...DEFAULTS.filter(map => !declared.has(map.id)).map(map => structuredClone(map)),
  ]
}
