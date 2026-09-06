// SPDX-License-Identifier: MIT

import type { GamepadBinding, InputAction, InputBinding, InputMap } from '@shared/domain/inputMap'
import type { GamepadState, InputState } from '../ports/inputPort'
import { clamp } from '../numeric'

type InputVector = { x: number; y: number }

/** What a map is resolved against: the reading itself, minus what names no binding. */
export type RawInput = Pick<InputState, 'held' | 'gamepads'> & Partial<Pick<InputState, 'pointer'>>

export type ResolvedInput = {
  button: (id: string) => boolean
  axis: (id: string) => number
  axis2: (id: string) => InputVector
  values: Readonly<Record<string, InputActionValue>>
}

export type InputActionValue = boolean | number | InputVector

const ZERO: InputVector = { x: 0, y: 0 }
export const DEFAULT_GAMEPAD_DEAD_ZONE = 0.15

export function resolveInputMaps(
  maps: readonly InputMap[],
  active: readonly string[],
  input: RawInput,
): ResolvedInput {
  const activeIds = new Set(active)
  const values: Record<string, InputActionValue> = {}
  // No `slice` before the sort: `filter` already answers a new array, and this runs once a step.
  const ordered = maps
    .filter(map => activeIds.has(map.id))
    .sort((one, other) => one.priority - other.priority)

  for (const map of ordered) {
    for (const action of map.actions) values[action.id] = valueOf(action, input)
  }

  return {
    button: id => values[id] === true,
    axis: id => {
      const value = values[id]
      return typeof value === 'number' ? value : 0
    },
    axis2: id => {
      const value = values[id]
      return isVector(value) ? value : ZERO
    },
    values,
  }
}

function valueOf(action: InputAction, input: RawInput): InputActionValue {
  if (action.kind === 'button') return action.bindings.some(binding => buttonOf(binding, input))
  if (action.kind === 'axis1') return axisValueOf(action, input)
  return vectorValueOf(action, input)
}

/**
 * 🛑 Half-axes SUM and a stick wins by magnitude. Two opposite halves held must cancel, which
 * `stronger` alone never did: it kept the first of them for ever.
 */
function axisValueOf(action: InputAction, input: RawInput): number {
  let halves = 0
  let axes = 0
  for (const binding of action.bindings) {
    const value = axisOf(binding, input)
    if (isHalfAxis(binding)) halves += value
    else axes = stronger(axes, value)
  }
  return stronger(clamp(halves, -1, 1), axes)
}

function vectorValueOf(action: InputAction, input: RawInput): InputVector {
  const halves: InputVector = { x: 0, y: 0 }
  let axes: InputVector = ZERO
  for (const binding of action.bindings) {
    const value = vectorOf(binding, input)
    if (isHalfAxis(binding)) {
      halves.x += value.x
      halves.y += value.y
    } else axes = strongerVector(axes, value)
  }
  return strongerVector({ x: clamp(halves.x, -1, 1), y: clamp(halves.y, -1, 1) }, axes)
}

/**
 * Whether a binding can only push ONE way — a key, a button, a trigger. The seam is the control,
 * never the device: two triggers scaled apart are a pair of halves exactly as two keys are, and
 * reading `device` alone gave a plane holding both of them full throttle BACKWARDS.
 */
function isHalfAxis(binding: InputBinding): boolean {
  if (binding.device !== 'gamepad') return true
  return buttonIndex(binding.control) !== null
}

function buttonOf(binding: InputAction['bindings'][number], input: RawInput): boolean {
  if (binding.device === 'keyboard') return input.held.includes(binding.code)
  if (binding.device === 'mouse')
    return binding.control === 'primary' && input.pointer?.down === true
  return axisOf(binding, input) > 0.5
}

function axisOf(binding: InputAction['bindings'][number], input: RawInput): number {
  if (binding.device === 'keyboard')
    return input.held.includes(binding.code) ? (binding.scale ?? 1) : 0
  if (binding.device !== 'gamepad') return 0
  const raw = (input.gamepads ?? []).reduce(
    (strongest, gamepad) => stronger(strongest, rawGamepadAxis(gamepad, binding)),
    0,
  )
  const deadZone = binding.deadZone ?? DEFAULT_GAMEPAD_DEAD_ZONE
  if (Math.abs(raw) <= deadZone) return 0
  return (binding.invert ? -raw : raw) * (binding.scale ?? 1)
}

function vectorOf(binding: InputAction['bindings'][number], input: RawInput): InputVector {
  if (binding.device === 'keyboard') {
    if (!input.held.includes(binding.code)) return ZERO
    const value = binding.scale ?? 1
    return binding.axis === 'x' ? { x: value, y: 0 } : { x: 0, y: value }
  }
  if (binding.device !== 'gamepad') return ZERO
  const vector = (input.gamepads ?? []).reduce<InputVector>(
    (strongest, gamepad) => strongerVector(strongest, rawGamepadVector(gamepad, binding)),
    ZERO,
  )
  const deadZone = binding.deadZone ?? DEFAULT_GAMEPAD_DEAD_ZONE
  return {
    x:
      Math.abs(vector.x) <= deadZone
        ? 0
        : (binding.invert ? -vector.x : vector.x) * (binding.scale ?? 1),
    y:
      Math.abs(vector.y) <= deadZone
        ? 0
        : (binding.invert ? -vector.y : vector.y) * (binding.scale ?? 1),
  }
}

function rawGamepadAxis(gamepad: GamepadState, binding: GamepadBinding): number {
  if (gamepad.mapping !== 'standard') return 0
  const index = buttonIndex(binding.control)
  if (index !== null) return gamepad.buttons[index] ?? 0
  const axis = axisIndex(binding.control)
  return axis === null ? 0 : (gamepad.axes[axis] ?? 0)
}

function rawGamepadVector(gamepad: GamepadState, binding: GamepadBinding): InputVector {
  if (gamepad.mapping !== 'standard') return ZERO
  if (binding.control !== 'leftStick' && binding.control !== 'rightStick') return ZERO
  const offset = binding.control === 'leftStick' ? 0 : 2
  return { x: gamepad.axes[offset] ?? 0, y: gamepad.axes[offset + 1] ?? 0 }
}

function axisIndex(control: string): number | null {
  if (control === 'leftStickX') return 0
  if (control === 'leftStickY') return 1
  if (control === 'rightStickX') return 2
  if (control === 'rightStickY') return 3
  return null
}

/** The standard mapping's button order — exported so a suite names a control, never an index. */
export const GAMEPAD_BUTTONS: readonly string[] = [
  'south',
  'east',
  'west',
  'north',
  'leftShoulder',
  'rightShoulder',
  'leftTrigger',
  'rightTrigger',
  'select',
  'start',
  'leftStickButton',
  'rightStickButton',
  'dpadUp',
  'dpadDown',
  'dpadLeft',
  'dpadRight',
  'home',
]

function buttonIndex(control: string): number | null {
  const index = GAMEPAD_BUTTONS.indexOf(control)
  return index < 0 ? null : index
}

function stronger(one: number, other: number): number {
  return Math.abs(other) > Math.abs(one) ? other : one
}

function strongerVector(one: InputVector, other: InputVector): InputVector {
  return { x: stronger(one.x, other.x), y: stronger(one.y, other.y) }
}

function isVector(value: InputActionValue | undefined): value is InputVector {
  return typeof value === 'object' && value !== null
}
