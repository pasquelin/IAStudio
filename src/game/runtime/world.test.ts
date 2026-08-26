// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { STEP_SECONDS } from './gameLoop'
import type { System } from './world'
import { testWorld } from './world-fixtures'

const noting = (name: System['name'], into: string[]): System => ({
  name,
  reads: [],
  writes: [],
  fixedUpdate: () => into.push(name),
})

describe('one fixed step of a world', () => {
  it('runs its systems in the declared order, whatever order they were registered in', () => {
    const ran: string[] = []
    testWorld({ systems: [noting('camera', ran), noting('input', ran)] }).step(STEP_SECONDS)

    expect(ran).toEqual(['input', 'camera'])
  })

  it('counts in ticks first, and in seconds beside them', () => {
    const world = testWorld()
    world.step(STEP_SECONDS)
    world.step(STEP_SECONDS)

    expect(world.time.tick).toBe(2)
    expect(world.time.elapsed).toBeCloseTo(2 * STEP_SECONDS, 10)
    expect(world.time.step).toBe(STEP_SECONDS)
  })

  /**
   * A system spawning while it walks the entities it reads would walk what it just made, for ever.
   * Both births and deaths land at the end of the step, so the sweep of a step is a fixed set.
   */
  it('shows a spawned entity to the NEXT step, never to the one that made it', () => {
    let seen = -1
    const world = testWorld({
      systems: [
        {
          name: 'gameplay',
          reads: [],
          writes: [],
          fixedUpdate: one => {
            if (one.time.tick === 0) one.spawn({ name: 'torch' })
            seen = one.entities.count()
          },
        },
      ],
    })

    world.step(STEP_SECONDS)
    expect(seen).toBe(0)
    expect(world.entities.count()).toBe(1)
  })

  it('keeps a destroyed entity for the rest of the step that killed it', () => {
    const world = testWorld()
    const torch = world.spawn({ name: 'torch' })
    world.step(STEP_SECONDS)

    world.destroy(torch.id)
    expect(world.entities.get(torch.id)).not.toBeNull()

    world.step(STEP_SECONDS)
    expect(world.entities.get(torch.id)).toBeNull()
  })

  it('says so on the bus when an entity is born and when it dies', () => {
    const heard: string[] = []
    const world = testWorld()
    world.events.on('EntitySpawned', event => heard.push(`+${event.entity ?? ''}`))
    world.events.on('EntityDestroyed', event => heard.push(`-${event.entity ?? ''}`))

    const torch = world.spawn({ name: 'torch' })
    world.step(STEP_SECONDS)
    world.destroy(torch.id)
    world.step(STEP_SECONDS)

    expect(heard).toEqual(['+spawn_1', '-spawn_1'])
  })

  /** Identifiers are counted, never drawn: two runs of one seed must mint the same ones. */
  it('mints the same identifiers in the same order, run after run', () => {
    const once = testWorld()
    const again = testWorld()

    expect([once.spawn({ name: 'a' }).id, once.spawn({ name: 'b' }).id]).toEqual([
      again.spawn({ name: 'a' }).id,
      again.spawn({ name: 'b' }).id,
    ])
  })

  it('reads the input once, as data of the tick', () => {
    const world = testWorld()
    const before = world.input

    world.step(STEP_SECONDS)

    expect(world.input).not.toBe(before)
    expect(world.input.held).toEqual([])
  })
})

describe('what a system may ask the world for', () => {
  it('attaches at the end of the step, so a sweep is a fixed set', () => {
    const seen: number[] = []
    const world = testWorld({
      systems: [
        {
          name: 'gameplay',
          reads: ['Health'],
          writes: ['Health'],
          fixedUpdate: one => {
            let count = 0
            for (const entity of one.entities.withComponent('Health')) {
              count += 1
              if (count === 1) one.attach(entity, { type: 'Health', current: 1, max: 1 })
            }
            seen.push(count)
          },
        },
      ],
    })

    const first = world.spawn({ name: 'a', components: [{ type: 'Health', current: 5, max: 5 }] })
    world.step(STEP_SECONDS)
    world.step(STEP_SECONDS)

    expect(seen).toEqual([0, 1])
    expect(first.components).toEqual([{ type: 'Health', current: 1, max: 1 }])
  })

  it('says nothing about a death that never happened, and says one death once', () => {
    const heard: string[] = []
    const world = testWorld()
    world.events.on('EntityDestroyed', event => heard.push(event.entity ?? ''))

    world.destroy('nobody')
    const torch = world.spawn({ name: 'torch' })
    world.destroy(torch.id)
    world.destroy(torch.id)
    world.step(STEP_SECONDS)

    expect(heard).toEqual([torch.id])
  })

  /** A world restored from a save carries its `spawn_1` already — see `random.state()`. */
  it('mints no identifier the world already carries', () => {
    const world = testWorld()
    world.entities.add({
      id: 'spawn_1',
      name: 'restored',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      components: [],
    })

    expect(world.spawn({ name: 'fresh' }).id).toBe('spawn_2')
  })

  /** A throw here used to skip `endStep` and the tick, so the frame retried and threw for ever. */
  it('carries on, and says so, when a system throws', () => {
    const world = testWorld({
      systems: [
        {
          name: 'script',
          reads: [],
          writes: [],
          fixedUpdate: () => {
            throw new Error('broken')
          },
        },
      ],
    })

    world.step(STEP_SECONDS)

    expect(world.time.tick).toBe(1)
    expect(world.ports.log.recent().map(entry => entry.message)).toEqual([
      'system script threw: broken',
    ])
  })
})
