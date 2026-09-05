// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { InputMap } from '@shared/domain/inputMap'
import { createInputContexts } from './inputContexts'

const map = (id: string, priority: number, defaultActive: boolean): InputMap => ({
  version: 1,
  id,
  priority,
  defaultActive,
  actions: [{ id: 'interact', kind: 'button', bindings: [{ device: 'keyboard', code: 'KeyE' }] }],
})

describe('input contexts', () => {
  it('starts default contexts and adds a vehicle context only once', () => {
    const contexts = createInputContexts([map('character', 0, true), map('vehicle', 10, false)])

    expect(contexts.active()).toEqual(['character'])
    contexts.push('vehicle')
    contexts.push('vehicle')

    expect(contexts.active()).toEqual(['character', 'vehicle'])
  })

  it('removes a context without changing the remaining stack', () => {
    const contexts = createInputContexts([map('character', 0, true), map('vehicle', 10, false)])
    contexts.push('vehicle')

    contexts.pop('vehicle')

    expect(contexts.active()).toEqual(['character'])
  })
})
