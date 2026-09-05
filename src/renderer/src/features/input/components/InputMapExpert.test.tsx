// SPDX-License-Identifier: MIT
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { InputMap } from '@shared/domain/inputMap'
import { InputMapExpert } from './InputMapExpert'

it('replaces bindings that no longer fit when an action kind changes', async () => {
  const map: InputMap = {
    version: 1,
    id: 'character',
    priority: 0,
    defaultActive: true,
    actions: [{ id: 'jump', kind: 'button', bindings: [{ device: 'keyboard', code: 'Space' }] }],
  }
  const onChange = vi.fn()
  render(<InputMapExpert map={map} onChange={onChange} />)

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Valeur' }), 'axis1')

  expect(onChange).toHaveBeenCalledWith({
    ...map,
    actions: [
      { id: 'jump', kind: 'axis1', bindings: [{ device: 'gamepad', control: 'leftStickX' }] },
    ],
  })
})
