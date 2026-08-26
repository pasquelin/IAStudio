// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { Component } from '@shared/domain/component'
import { componentOf, restingTransform } from './entity'

const health: Component = { type: 'Health', current: 3, max: 5 }

describe('what an entity carries', () => {
  it('answers the component of a type, and nothing for one it has not got', () => {
    const entity = { id: 'a', name: 'a', transform: restingTransform(), components: [health] }

    expect(componentOf(entity, 'Health')).toEqual(health)
    expect(componentOf(entity, 'Movement')).toBeNull()
  })
})
