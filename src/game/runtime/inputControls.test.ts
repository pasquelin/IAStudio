// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import {
  inputBindingFits,
  inputBindingOf,
  type InputActionKind,
  type InputBinding,
  type InputMap,
} from '@shared/domain/inputMap'
import { createInputControls } from './inputControls'

const defaults: readonly InputMap[] = [
  {
    version: 1,
    id: 'character',
    priority: 0,
    defaultActive: true,
    actions: [{ id: 'jump', kind: 'button', bindings: [{ device: 'keyboard', code: 'Space' }] }],
  },
]

describe('runtime input controls', () => {
  it('rebinds one action without changing the project defaults', () => {
    const controls = createInputControls(defaults)

    expect(controls.rebind('character', 'jump', 0, { device: 'keyboard', code: 'Enter' })).toBe(
      true,
    )

    expect(controls.maps()[0]?.actions[0]?.bindings).toEqual([
      { device: 'keyboard', code: 'Enter' },
    ])
    expect(defaults[0]?.actions[0]?.bindings).toEqual([{ device: 'keyboard', code: 'Space' }])
    expect(controls.bindings().character?.jump).toEqual([{ device: 'keyboard', code: 'Enter' }])
  })

  it('resets bindings and persists both changes', () => {
    const write = vi.fn()
    const controls = createInputControls(defaults, { read: () => null, write })

    controls.rebind('character', 'jump', 0, { device: 'keyboard', code: 'Enter' })
    controls.reset()

    expect(controls.maps()).toEqual(defaults)
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('refuses an unknown action and a malformed binding', () => {
    const controls = createInputControls(defaults)

    expect(controls.rebind('character', 'missing', 0, { device: 'keyboard', code: 'Enter' })).toBe(
      false,
    )
    expect(controls.rebind('character', 'jump', 0, { device: 'keyboard' })).toBe(false)
  })
})

/**
 * 🛑 One format, TWO readers, and nothing but this holding them together.
 *
 * An exported game ships MIT and takes no VALUE from `@shared/` (see `createWorld`), so
 * `inputControls` re-implements what `inputMap` already reads. They had already drifted: a
 * non-boolean `invert` was DROPPED by the studio and REFUSED by the runtime, so the studio wrote
 * a map the game discarded whole — and the player lost every rebinding, silently.
 */
const KINDS: readonly InputActionKind[] = ['button', 'axis1', 'axis2']

const CANDIDATES: readonly unknown[] = [
  null,
  'leftStick',
  { device: 'pedal', control: 'primary' },
  { device: 'keyboard' },
  { device: 'keyboard', code: '' },
  { device: 'keyboard', code: 'Space' },
  { device: 'keyboard', code: 'KeyA', axis: 'x' },
  { device: 'keyboard', code: 'KeyA', axis: 'z' },
  { device: 'keyboard', code: 'KeyA', scale: -1 },
  { device: 'keyboard', code: 'KeyA', scale: Number.NaN },
  { device: 'mouse', control: 'primary' },
  { device: 'mouse', control: 'secondary' },
  { device: 'gamepad', control: 'leftStick' },
  { device: 'gamepad', control: 'leftStickX' },
  { device: 'gamepad', control: 'leftStickButton' },
  { device: 'gamepad', control: 'south' },
  { device: 'gamepad', control: 'touchpad' },
  { device: 'gamepad', control: 'leftTrigger', deadZone: 0.2 },
  { device: 'gamepad', control: 'leftTrigger', deadZone: 1 },
  { device: 'gamepad', control: 'leftTrigger', deadZone: -0.1 },
  { device: 'gamepad', control: 'leftStick', invert: true },
  { device: 'gamepad', control: 'leftStick', invert: 'yes' },
  { device: 'gamepad', control: 'leftStick', scale: 2 },
  { device: 'gamepad', control: 'leftStick', scale: Number.POSITIVE_INFINITY },
]

function readByStudio(kind: InputActionKind, value: unknown): InputBinding | null {
  try {
    const parsed = inputBindingOf(value)
    return inputBindingFits(kind, parsed) ? parsed : null
  } catch {
    // The studio reader REFUSES by throwing where the runtime one returns null: the two shapes
    // are what this guard exists to compare, so the throw is the refusal.
    return null
  }
}

function readByRuntime(kind: InputActionKind, value: unknown): InputBinding | null {
  const controls = createInputControls([
    {
      version: 1,
      id: 'context',
      priority: 0,
      defaultActive: true,
      actions: [{ id: 'action', kind, bindings: [{ device: 'keyboard', code: 'Space' }] }],
    },
  ])
  if (!controls.rebind('context', 'action', 0, value)) return null
  return controls.bindings().context?.action?.[0] ?? null
}

const shown = (binding: InputBinding | null): string =>
  binding === null ? 'refused' : JSON.stringify(binding, Object.keys(binding).sort())

describe('the studio reader and the runtime reader of one input map', () => {
  it('answers the same on every candidate binding, kind by kind', () => {
    const disagreements = KINDS.flatMap(kind =>
      CANDIDATES.map(value => ({
        kind,
        value,
        studio: shown(readByStudio(kind, value)),
        runtime: shown(readByRuntime(kind, value)),
      })).filter(seen => seen.studio !== seen.runtime),
    )

    expect(disagreements).toEqual([])
  })
})
