// SPDX-License-Identifier: MIT

import type {
  GamepadBinding,
  InputAction,
  InputActionKind,
  InputBinding,
  GamepadControl,
  InputMap,
  KeyboardBinding,
  MouseBinding,
} from '@shared/domain/inputMap'
import { withDefaultInputMaps } from './inputDefaults'

export type InputBindings = Readonly<
  Record<string, Readonly<Record<string, readonly InputBinding[]>>>
>

export type InputControlsStorage = {
  read: () => unknown
  write: (maps: readonly InputMap[]) => void
}

export type InputControls = {
  maps: () => readonly InputMap[]
  bindings: () => InputBindings
  revision: () => number
  rebind: (context: string, action: string, index: number, binding: unknown) => boolean
  reset: (context?: string, action?: string) => void
}

/**
 * 🛑 What is given is COMPLETED by the built-in contexts, never replaced: a project that declares
 * no `.input.json` still walks, drives and flies — see `inputDefaults`.
 */
export function createInputControls(
  given: readonly InputMap[],
  storage?: InputControlsStorage,
): InputControls {
  const defaults = structuredClone(withDefaultInputMaps(given))
  let maps = restored(defaults, storage)
  let bindings = bindingsOf(maps)
  let revision = 0

  const persist = (): void => {
    try {
      storage?.write(maps)
    } catch {
      // Storage is optional; input must keep working when a browser refuses it.
    }
  }

  return {
    maps: () => maps,
    bindings: () => bindings,
    revision: () => revision,
    rebind: (context, action, index, binding) => {
      const changed = rebound(maps, context, action, index, binding)
      if (!changed) return false
      maps = changed
      bindings = bindingsOf(maps)
      revision += 1
      persist()
      return true
    },
    reset: (context, action) => {
      maps = resetMaps(maps, defaults, context, action)
      bindings = bindingsOf(maps)
      revision += 1
      persist()
    },
  }
}

function bindingsOf(maps: readonly InputMap[]): InputBindings {
  return Object.fromEntries(
    maps.map(map => [
      map.id,
      Object.fromEntries(map.actions.map(action => [action.id, action.bindings])),
    ]),
  )
}

function rebound(
  maps: readonly InputMap[],
  context: string,
  actionId: string,
  index: number,
  binding: unknown,
): readonly InputMap[] | null {
  if (!Number.isInteger(index) || index < 0) return null
  const mapIndex = maps.findIndex(map => map.id === context)
  const map = maps[mapIndex]
  if (!map) return null
  const actionIndex = map.actions.findIndex(action => action.id === actionId)
  const action = map.actions[actionIndex]
  if (!action || index > action.bindings.length) return null

  const parsed = bindingOf(binding)
  if (!parsed || !accepts(action.kind, parsed)) return null
  const bindings = [...action.bindings]
  bindings[index] = parsed
  const changed: InputMap = {
    ...map,
    actions: map.actions.map((one, at) => (at === actionIndex ? { ...one, bindings } : one)),
  }
  return maps.map((one, at) => (at === mapIndex ? changed : one))
}

function resetMaps(
  current: readonly InputMap[],
  defaults: readonly InputMap[],
  context?: string,
  action?: string,
): readonly InputMap[] {
  if (!context) return structuredClone(defaults)
  const original = defaults.find(map => map.id === context)
  if (!original) return [...current]
  return current.map(map => {
    if (map.id !== context) return map
    if (!action) return structuredClone(original)
    const originalAction = original.actions.find(one => one.id === action)
    if (!originalAction) return map
    return {
      ...map,
      actions: map.actions.map(one => (one.id === action ? structuredClone(originalAction) : one)),
    }
  })
}

function restored(
  defaults: readonly InputMap[],
  storage?: InputControlsStorage,
): readonly InputMap[] {
  if (!storage) return structuredClone(defaults)
  try {
    return restoredMaps(defaults, storage.read()) ?? structuredClone(defaults)
  } catch {
    return structuredClone(defaults)
  }
}

/**
 * 🛑 Matched by ID, action by action, never by POSITION. It used to answer null — dropping EVERY
 * rebinding of EVERY context — as soon as the project held one map or one action more than the
 * stored copy: a player's remapped hand brake was lost because the author added a `menu` map.
 * What no longer exists is ignored; what was never stored keeps its default.
 */
function restoredMaps(defaults: readonly InputMap[], value: unknown): readonly InputMap[] | null {
  if (!Array.isArray(value)) return null
  const stored = byId(value)
  return defaults.map(map => restoredMapOf(map, stored.get(map.id)))
}

function restoredMapOf(defaultMap: InputMap, value: unknown): InputMap {
  if (!isRecord(value) || !Array.isArray(value.actions)) return defaultMap
  const stored = byId(value.actions)
  return {
    ...defaultMap,
    actions: defaultMap.actions.map(action => restoredActionOf(action, stored.get(action.id))),
  }
}

function restoredActionOf(action: InputAction, value: unknown): InputAction {
  if (!isRecord(value) || !Array.isArray(value.bindings)) return action
  const kept = value.bindings
    .map(bindingOf)
    .filter(binding => binding !== null)
    .filter(binding => accepts(action.kind, binding))
  // Everything stored was rubbish: the defaults, rather than an action nothing reaches any more.
  // An EMPTY stored list is a choice, though — someone unbound it on purpose.
  return value.bindings.length > 0 && kept.length === 0 ? action : { ...action, bindings: kept }
}

function byId(values: readonly unknown[]): Map<string, unknown> {
  const found = new Map<string, unknown>()
  for (const value of values)
    if (isRecord(value) && typeof value.id === 'string') found.set(value.id, value)
  return found
}

function bindingOf(value: unknown): InputBinding | null {
  if (!isRecord(value)) return null
  if (value.device === 'keyboard') return keyboardOf(value)
  if (value.device === 'mouse') return mouseOf(value.control)
  if (value.device === 'gamepad') return gamepadOf(value)
  return null
}

function keyboardOf(value: Record<string, unknown>): KeyboardBinding | null {
  if (typeof value.code !== 'string' || value.code.length === 0) return null
  if (value.axis !== undefined && value.axis !== 'x' && value.axis !== 'y') return null
  if (!optionalNumber(value.scale)) return null
  return {
    device: 'keyboard',
    code: value.code,
    ...(value.axis === undefined ? {} : { axis: value.axis }),
    ...(value.scale === undefined ? {} : { scale: value.scale }),
  }
}

function mouseOf(control: unknown): MouseBinding | null {
  return control === 'primary' ? { device: 'mouse', control } : null
}

function gamepadOf(value: Record<string, unknown>): GamepadBinding | null {
  if (!isGamepadControl(value.control)) return null
  if (value.deadZone !== undefined && !deadZone(value.deadZone)) return null
  if (value.invert !== undefined && typeof value.invert !== 'boolean') return null
  if (!optionalNumber(value.scale)) return null
  return {
    device: 'gamepad',
    control: value.control,
    ...(value.deadZone === undefined ? {} : { deadZone: value.deadZone }),
    ...(value.invert === undefined ? {} : { invert: value.invert }),
    ...(value.scale === undefined ? {} : { scale: value.scale }),
  }
}

const SUPPORTED_GAMEPAD =
  /^(?:leftStick|rightStick)(?:X|Y|Button)?$|^(?:south|east|west|north|leftShoulder|rightShoulder|leftTrigger|rightTrigger|select|start|dpadUp|dpadDown|dpadLeft|dpadRight|home)$/

const isGamepadControl = (value: unknown): value is GamepadControl =>
  typeof value === 'string' && SUPPORTED_GAMEPAD.test(value)

function accepts(kind: InputActionKind, binding: InputBinding): boolean {
  if (kind === 'button') {
    if (binding.device === 'keyboard')
      return binding.axis === undefined && binding.scale === undefined
    return binding.device !== 'gamepad' || !/Stick(?:X|Y)?$/.test(binding.control)
  }
  if (binding.device === 'mouse') return false
  if (kind === 'axis1') {
    if (binding.device === 'keyboard') return binding.axis === undefined
    // Anything but a two-way stick — see `inputBindingFits`, which this is held to.
    return binding.control !== 'leftStick' && binding.control !== 'rightStick'
  }
  if (binding.device === 'keyboard') return binding.axis !== undefined
  return binding.control === 'leftStick' || binding.control === 'rightStick'
}

const optionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value))

const deadZone = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value < 1

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
