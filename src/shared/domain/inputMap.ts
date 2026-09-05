export const INPUT_MAP_VERSION = 1
export const INPUT_MAP_EXTENSION = '.input.json'

export type InputActionKind = 'button' | 'axis1' | 'axis2'

export type KeyboardBinding = {
  device: 'keyboard'
  code: string
  axis?: 'x' | 'y'
  scale?: number
}
export type MouseBinding = {
  device: 'mouse'
  control: 'primary'
}
export type GamepadControl =
  | 'leftStick'
  | 'rightStick'
  | 'leftStickX'
  | 'leftStickY'
  | 'rightStickX'
  | 'rightStickY'
  | 'south'
  | 'east'
  | 'west'
  | 'north'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftTrigger'
  | 'rightTrigger'
  | 'select'
  | 'start'
  | 'leftStickButton'
  | 'rightStickButton'
  | 'dpadUp'
  | 'dpadDown'
  | 'dpadLeft'
  | 'dpadRight'
  | 'home'
export type GamepadBinding = {
  device: 'gamepad'
  control: GamepadControl
  deadZone?: number
  invert?: boolean
  scale?: number
}

export type InputBinding = KeyboardBinding | MouseBinding | GamepadBinding

export type InputAction = {
  id: string
  kind: InputActionKind
  bindings: readonly InputBinding[]
}

export type InputMap = {
  version: number
  id: string
  priority: number
  defaultActive: boolean
  actions: readonly InputAction[]
}

export type InputMapModule = { path: string; map: InputMap }

export function inputMapOf(value: unknown): InputMap {
  if (!isRecord(value)) throw new Error('input map must be an object')
  const { version, id, priority, defaultActive, actions } = value
  if (version !== INPUT_MAP_VERSION) throw new Error('unsupported input map version')
  if (typeof id !== 'string' || id.length === 0) throw new Error('input map id is required')
  if (typeof priority !== 'number' || !Number.isFinite(priority))
    throw new Error('invalid input priority')
  if (typeof defaultActive !== 'boolean') throw new Error('input defaultActive is required')
  if (!Array.isArray(actions)) throw new Error('input actions must be an array')

  const parsed = actions.map(inputActionOf)
  if (new Set(parsed.map(action => action.id)).size !== parsed.length)
    throw new Error('input action ids must be unique')

  return { version, id, priority, defaultActive, actions: parsed }
}

function inputActionOf(value: unknown): InputAction {
  if (!isRecord(value)) throw new Error('input action must be an object')
  const { id, kind, bindings } = value
  if (typeof id !== 'string' || id.length === 0) throw new Error('input action id is required')
  if (!isActionKind(kind)) throw new Error('invalid input action kind')
  if (!Array.isArray(bindings)) throw new Error('input bindings must be an array')

  const parsed = bindings.map(inputBindingOf)
  if (parsed.some(binding => !bindingFits(kind, binding)))
    throw new Error('input binding does not match its action kind')

  return { id, kind, bindings: parsed }
}

export function inputBindingOf(value: unknown): InputBinding {
  if (!isRecord(value) || typeof value.device !== 'string') throw new Error('invalid input binding')

  if (value.device === 'keyboard') return keyboardBindingOf(value)

  if (value.device === 'mouse' && isMouseControl(value.control))
    return { device: 'mouse', control: value.control }

  if (value.device === 'gamepad') return gamepadBindingOf(value)

  throw new Error('invalid input binding')
}

function keyboardBindingOf(value: Record<string, unknown>): KeyboardBinding {
  if (typeof value.code !== 'string' || value.code.length === 0)
    throw new Error('invalid input binding')
  if (value.axis !== undefined && value.axis !== 'x' && value.axis !== 'y')
    throw new Error('invalid keyboard axis')
  const scale = numericScale(value.scale)
  return {
    device: 'keyboard',
    code: value.code,
    ...(value.axis === undefined ? {} : { axis: value.axis }),
    ...(scale === undefined ? {} : { scale }),
  }
}

function gamepadBindingOf(value: Record<string, unknown>): GamepadBinding {
  if (!isGamepadControl(value.control)) throw new Error('invalid input binding')
  const options = numericOptions(value)
  return {
    device: 'gamepad',
    control: value.control,
    ...(options.deadZone === undefined ? {} : { deadZone: options.deadZone }),
    ...(typeof value.invert !== 'boolean' ? {} : { invert: value.invert }),
    ...(options.scale === undefined ? {} : { scale: options.scale }),
  }
}

function numericOptions(value: Record<string, unknown>): { deadZone?: number; scale?: number } {
  const deadZone = value.deadZone
  const scale = value.scale
  if (deadZone !== undefined && (typeof deadZone !== 'number' || deadZone < 0 || deadZone >= 1))
    throw new Error('invalid gamepad dead zone')
  if (scale !== undefined && (typeof scale !== 'number' || !Number.isFinite(scale)))
    throw new Error('invalid gamepad scale')
  return {
    ...(typeof deadZone === 'number' ? { deadZone } : {}),
    ...(typeof scale === 'number' ? { scale } : {}),
  }
}

function numericScale(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('invalid keyboard scale')
  return value
}

function isActionKind(value: unknown): value is InputActionKind {
  return value === 'button' || value === 'axis1' || value === 'axis2'
}

function isMouseControl(value: unknown): value is MouseBinding['control'] {
  return value === 'primary'
}

function isGamepadControl(value: unknown): value is GamepadControl {
  return (
    typeof value === 'string' &&
    /^(?:leftStick|rightStick)(?:X|Y|Button)?$|^(?:south|east|west|north|leftShoulder|rightShoulder|leftTrigger|rightTrigger|select|start|dpadUp|dpadDown|dpadLeft|dpadRight|home)$/.test(
      value,
    )
  )
}

function isAxisBinding(binding: InputBinding): boolean {
  return (
    (binding.device === 'keyboard' &&
      (binding.axis !== undefined || binding.scale !== undefined)) ||
    (binding.device === 'gamepad' &&
      (binding.control.endsWith('Stick') ||
        binding.control.endsWith('StickX') ||
        binding.control.endsWith('StickY')))
  )
}

function bindingFits(kind: InputActionKind, binding: InputBinding): boolean {
  if (kind === 'button') return !isAxisBinding(binding)
  if (binding.device === 'mouse') return false
  if (kind === 'axis1') {
    if (binding.device === 'keyboard') return binding.axis === undefined
    return (
      binding.control.endsWith('X') ||
      binding.control.endsWith('Y') ||
      binding.control.endsWith('Trigger')
    )
  }
  if (binding.device === 'keyboard') return binding.axis !== undefined
  return binding.control === 'leftStick' || binding.control === 'rightStick'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
