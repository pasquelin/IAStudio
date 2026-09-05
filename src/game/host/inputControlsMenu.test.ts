// SPDX-License-Identifier: MIT

import { createInputControls } from '../runtime/inputControls'
import type { InputMap } from '@shared/domain/inputMap'
import { describe, expect, it } from 'vitest'
import { createInputControlsMenu } from './inputControlsMenu'

const MAPS: readonly InputMap[] = [
  {
    version: 1,
    id: 'character',
    priority: 0,
    defaultActive: true,
    actions: [{ id: 'jump', kind: 'button', bindings: [{ device: 'keyboard', code: 'Space' }] }],
  },
]

const LABELS = {
  title: 'Controls',
  close: 'Close',
  reset: 'Reset all',
  change: 'Change',
  capture: 'Press a key or controller button',
  keyboard: 'Keyboard',
  gamepad: 'Gamepad',
  mouse: 'Mouse',
}

describe('exported controls menu', () => {
  it('opens, rebinds a control, resets it and disposes its page API', () => {
    const controls = createInputControls(MAPS)
    const menu = createInputControlsMenu({ owner: document, controls, labels: LABELS })

    expect(Reflect.get(window, 'iaStudioControls')).toBe(menu)

    menu.open()
    const binding = document.querySelector<HTMLButtonElement>('[data-input-binding]')
    binding?.click()
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))
    expect(controls.bindings().character?.jump).toEqual([{ device: 'keyboard', code: 'Enter' }])

    document.querySelector<HTMLButtonElement>('[data-input-reset]')?.click()
    expect(controls.bindings().character?.jump).toEqual([{ device: 'keyboard', code: 'Space' }])

    menu.dispose()
    expect(Reflect.has(window, 'iaStudioControls')).toBe(false)
    expect(document.querySelector('[data-input-controls-menu]')).toBeNull()
  })

  it('toggles from Escape when no capture is active', () => {
    const menu = createInputControlsMenu({
      owner: document,
      controls: createInputControls(MAPS),
      labels: LABELS,
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    expect(menu.isOpen()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    expect(menu.isOpen()).toBe(false)
    menu.dispose()
  })
})
