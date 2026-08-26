// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { Component } from '@shared/domain/component'
import { restingTransform, type Entity } from './entity'
import { createEntityStore } from './entityStore'

const HEALTH: Component = { type: 'Health', current: 10, max: 10 }

const entity = (id: string, components: Component[] = []): Entity => ({
  id,
  name: id,
  transform: restingTransform(),
  components,
})

const idsOf = (found: Iterable<Entity>): string[] => [...found].map(one => one.id)

describe('the entities of one world', () => {
  it('indexes what an entity already carries when it arrives', () => {
    const store = createEntityStore()
    store.add(entity('a', [HEALTH]))
    store.add(entity('b'))

    expect(idsOf(store.withComponent('Health'))).toEqual(['a'])
    expect(store.count()).toBe(2)
  })

  it('keeps the order things arrived in, which a fixed step rests on', () => {
    const store = createEntityStore()
    for (const id of ['c', 'a', 'b']) store.add(entity(id, [HEALTH]))

    expect(idsOf(store.all())).toEqual(['c', 'a', 'b'])
    expect(idsOf(store.withComponent('Health'))).toEqual(['c', 'a', 'b'])
  })

  it('follows a component attached and detached after the fact', () => {
    const store = createEntityStore()
    const one = entity('a')
    store.add(one)

    store.attach(one, HEALTH)
    expect(idsOf(store.withComponent('Health'))).toEqual(['a'])
    expect(one.components).toEqual([HEALTH])

    expect(store.detach(one, 'Health')).toBe(true)
    expect(idsOf(store.withComponent('Health'))).toEqual([])
    expect(store.detach(one, 'Health')).toBe(false)
  })

  /** One of each type: attaching a second `Health` replaces the first rather than doubling it. */
  it('replaces a component of a type the entity already carries', () => {
    const store = createEntityStore()
    const one = entity('a', [HEALTH])
    store.add(one)

    store.attach(one, { type: 'Health', current: 3, max: 10 })

    expect(one.components).toEqual([{ type: 'Health', current: 3, max: 10 }])
    expect(idsOf(store.withComponent('Health'))).toEqual(['a'])
  })

  it('drops a removed entity from every index it was in', () => {
    const store = createEntityStore()
    store.add(entity('a', [HEALTH]))

    expect(store.remove('a')).toBe(true)
    expect(store.get('a')).toBeNull()
    expect(idsOf(store.withComponent('Health'))).toEqual([])
    expect(store.remove('a')).toBe(false)
  })

  it('answers an empty sweep for a component nothing carries', () => {
    expect(idsOf(createEntityStore().withComponent('Movement'))).toEqual([])
  })
})

/** Held before anything carried the type, the sweep used to be a frozen empty set for ever. */
it('hands back a sweep that fills as entities gain the component', () => {
  const store = createEntityStore()
  const movers = store.withComponent('Movement')
  const one = entity('a')
  store.add(one)
  store.attach(one, { type: 'Movement', speed: 1 })

  expect(idsOf(movers)).toEqual(['a'])
})
