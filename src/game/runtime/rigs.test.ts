// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { restingTransform, type Entity } from './entity'
import { createRigs } from './rigs'

const entity = (id: string): Entity => ({
  id,
  name: id,
  transform: restingTransform(),
  components: [],
})

describe('which arm takes the shot', () => {
  it('is the first of the sweep where no module names one', () => {
    const rigs = createRigs(null)
    rigs.take(entity('a'))
    rigs.take(entity('b'))

    expect(rigs.leader()?.id).toBe('a')
  })

  /**
   * 🛑 The module's own eye outranks the sweep: which arm was met first is not a choice an author
   * can see in the outliner, let alone make.
   */
  it('is the module eye, whichever arm the sweep met first', () => {
    const rigs = createRigs('eye')
    rigs.take(entity('a'))
    rigs.take(entity('eye'))

    expect(rigs.leader()?.id).toBe('eye')
  })

  it('holds the module eye against an arm that claims after it', () => {
    const rigs = createRigs('eye')
    rigs.take(entity('eye'))
    rigs.take(entity('a'))

    expect(rigs.leader()?.id).toBe('eye')
  })

  it('lets a released seat be claimed again', () => {
    const rigs = createRigs('eye')
    rigs.take(entity('eye'))
    rigs.release()
    rigs.take(entity('a'))

    expect(rigs.leader()?.id).toBe('a')
  })
})
