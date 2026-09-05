// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import type { InputMap } from '@shared/domain/inputMap'
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
