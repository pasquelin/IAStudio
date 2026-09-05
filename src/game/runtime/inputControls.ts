// SPDX-License-Identifier: MIT

import type {
  GamepadBinding,
  InputActionKind,
  InputBinding,
  InputMap,
  KeyboardBinding,
  MouseBinding,
} from '@shared/domain/inputMap'

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
  rebind: (context: string, action: string, index: number, binding: unknown) => boolean
  reset: (context?: string, action?: string) => void
}

export function createInputControls(
  given: readonly InputMap[],
  storage?: InputControlsStorage,
): InputControls {
  const defaults = structuredClone(given)
  let maps = restored(defaults, storage)

  const persist = (): void => {
    try {
      storage?.write(maps)
    } catch {
      // Storage is optional; input must keep working when a browser refuses it.
    }
  }

  return {
    maps: () => maps,
    bindings: () => bindingsOf(maps),
    rebind: (context, action, index, binding) => {
      const changed = rebound(maps, context, action, index, binding)
      if (!changed) return false
      maps = changed
      persist()
      return true
    },
    reset: (context, action) => {
      maps = resetMaps(maps, defaults, context, action)
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

function restoredMaps(defaults: readonly InputMap[], value: unknown): readonly InputMap[] | null {
  if (!Array.isArray(value) || value.length !== defaults.length) return null
  const maps: InputMap[] = []
  for (let index = 0; index < defaults.length; index += 1) {
    const restoredMap = restoredMapOf(defaults[index], value[index])
    if (!restoredMap) return null
    maps.push(restoredMap)
  }
  return maps
}

function restoredMapOf(defaultMap: InputMap | undefined, value: unknown): InputMap | null {
  if (
    !defaultMap ||
    !isRecord(value) ||
    value.id !== defaultMap.id ||
    !Array.isArray(value.actions)
  )
    return null
  const restoredActions = value.actions
  if (restoredActions.length !== defaultMap.actions.length) return null
  const actions = defaultMap.actions.map((action, index) => {
    const restoredAction = restoredActions[index]
    if (!isRecord(restoredAction) || restoredAction.id !== action.id) return null
    if (!Array.isArray(restoredAction.bindings)) return null
    const bindings = restoredAction.bindings.map(bindingOf)
    if (bindings.some(binding => binding === null)) return null
    const typed = bindings.filter(binding => binding !== null)
    return typed.every(binding => accepts(action.kind, binding))
      ? { ...action, bindings: typed }
      : null
  })
  return actions.some(action => action === null)
    ? null
    : { ...defaultMap, actions: actions.filter(action => action !== null) }
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
  if (
    control !== 'primary' &&
    control !== 'secondary' &&
    control !== 'middle' &&
    control !== 'wheel'
  )
    return null
  return { device: 'mouse', control }
}

function gamepadOf(value: Record<string, unknown>): GamepadBinding | null {
  if (typeof value.control !== 'string' || value.control.length === 0) return null
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

function accepts(kind: InputActionKind, binding: InputBinding): boolean {
  if (kind !== 'button') return true
  if (binding.device === 'keyboard')
    return binding.axis === undefined && binding.scale === undefined
  return binding.device !== 'gamepad' || !/Stick(?:X|Y)?$/.test(binding.control)
}

const optionalNumber = (value: unknown): value is number | undefined =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value))

const deadZone = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value < 1

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
